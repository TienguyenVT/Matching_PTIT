import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseServiceRole } from '@/lib/supabase/server';
import { analyzeStructuredJSON } from '@/lib/services/structured-json-analyzer';
import { parseCourseNameFromFileName } from '@/lib/services/pdf-analyzer';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

/**
 * API endpoint để xử lý JSON upload và tạo khóa học tự động
 * POST /api/admin/process-json
 */
export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Authenticate user
    const supabase = supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Vui lòng đăng nhập.' },
        { status: 401 }
      );
    }

    // Use service role client để bypass RLS
    const supabaseAdmin = supabaseServiceRole();

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const courseTitle = formData.get('courseTitle') as string | null;
    const courseDescription = formData.get('courseDescription') as string | null;
    const courseLevel = formData.get('courseLevel') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Không có file được upload.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      return NextResponse.json(
        { error: 'File phải là định dạng JSON.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File quá lớn. Kích thước tối đa là 10MB.' },
        { status: 400 }
      );
    }

    // Save file to temp directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = path.join(tmpdir(), `upload_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, buffer);

    console.log(`Processing JSON file: ${file.name}`);

    // Analyze JSON structure
    let analysisResult;
    try {
      analysisResult = analyzeStructuredJSON(tempFilePath);
    } catch (error: any) {
      console.error('Error analyzing JSON:', error);
      return NextResponse.json(
        { error: `Lỗi phân tích JSON: ${error.message}` },
        { status: 400 }
      );
    }

    if (analysisResult.chapters.length === 0) {
      return NextResponse.json(
        { error: 'JSON không có cấu trúc chương rõ ràng. Không thể tạo khóa học.' },
        { status: 400 }
      );
    }

    console.log(`Analysis complete: ${analysisResult.chapters.length} chapters found`);

    // Check if course already exists
    const finalCourseTitle = courseTitle || parseCourseNameFromFileName(file.name);
    const { data: existingCourse } = await supabaseAdmin
      .from('courses')
      .select('id, title')
      .eq('title', finalCourseTitle)
      .eq('is_active', true)
      .maybeSingle();

    if (existingCourse) {
      return NextResponse.json(
        { 
          error: `Khóa học "${finalCourseTitle}" đã tồn tại.`,
          existingCourseId: existingCourse.id
        },
        { status: 409 }
      );
    }

    // Create course
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .insert({
        title: finalCourseTitle,
        description: courseDescription || `Khóa học được tạo tự động từ tài liệu: ${file.name}`,
        level: (courseLevel as any) || 'Beginner',
        is_active: true,
        tags: []
      })
      .select()
      .single();

    if (courseError || !course) {
      console.error('Error creating course:', courseError);
      return NextResponse.json(
        { error: `Không thể tạo khóa học: ${courseError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log(`Course created: ${course.id} - ${course.title}`);

    // Create modules and contents
    let moduleOrder = 0;
    let totalLessons = 0;

    for (const chapter of analysisResult.chapters) {
      moduleOrder++;
      
      // Create module
      console.log(`Creating module ${moduleOrder}: ${chapter.title}`);
      const { data: module, error: moduleError } = await supabaseAdmin
        .from('course_modules')
        .insert({
          course_id: course.id,
          title: chapter.title,
          chapter_number: chapter.chapterNumber,
          description: `Học phần ${chapter.chapterNumber}: ${chapter.title}`,
          order_index: moduleOrder
        })
        .select()
        .single();

      if (moduleError || !module) {
        console.error(`Error creating module ${moduleOrder}:`, moduleError);
        continue; // Skip this module but continue with others
      }

      // Create lessons (sections) for this module
      let lessonOrder = 0;
      for (const section of chapter.sections) {
        lessonOrder++;
        totalLessons++;

        // Create lesson content
        const { data: lessonContent, error: lessonError } = await supabaseAdmin
          .from('course_contents')
          .insert({
            course_id: course.id,
            module_id: module.id,
            title: section.title,
            kind: 'doc',
            order_index: lessonOrder,
            storage_path: null
          })
          .select()
          .single();

        if (lessonError || !lessonContent) {
          console.error(`Error creating lesson:`, lessonError);
          continue;
        }

        // Save lesson content from JSON
        try {
          const { error: lessonContentInsertError } = await supabaseAdmin
            .from('lesson_content')
            .insert({
              content_id: lessonContent.id,
              content_text: section.content || ''
            });

          if (lessonContentInsertError) {
            console.error(`Error inserting lesson content:`, lessonContentInsertError);
          }
        } catch (genError: any) {
          console.error(`Error saving lesson content:`, genError);
        }
      }

      console.log(`Created ${lessonOrder} lessons for module ${module.title}`);
    }

    // Cleanup temp file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }
    }

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        description: course.description
      },
      statistics: {
        modules: moduleOrder,
        lessons: totalLessons
      }
    });

  } catch (error: any) {
    console.error('Error processing JSON:', error);
    
    // Cleanup temp file on error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file on error:', cleanupError);
      }
    }

    return NextResponse.json(
      { error: `Lỗi xử lý JSON: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

