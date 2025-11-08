import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseServiceRole } from '@/lib/supabase/server';
import { analyzePDFStructure, parseCourseNameFromFileName, validatePDFFile } from '@/lib/services/pdf-analyzer';
// AI removed: no content/quiz generation here
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

/**
 * API endpoint để xử lý PDF upload và tạo khóa học tự động
 * POST /api/admin/process-pdf
 */
export async function POST(req: NextRequest) {
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
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File phải là định dạng PDF.' },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File quá lớn. Kích thước tối đa là 50MB.' },
        { status: 400 }
      );
    }

    // Create temporary directory if not exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'pdfs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join(uploadDir, `${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, buffer);

    try {
      // Validate PDF file
      if (!validatePDFFile(tempFilePath)) {
        return NextResponse.json(
          { error: 'File PDF không hợp lệ.' },
          { status: 400 }
        );
      }

      console.log(`Processing PDF: ${file.name}`);

      // Analyze PDF structure
      const analysisResult = await analyzePDFStructure(tempFilePath);
      console.log(`Analysis complete: ${analysisResult.chapters.length} chapters found`);

      // Use service role client để bypass RLS khi tạo course
      const supabaseAdmin = supabaseServiceRole();

      // Parse course name
      const courseName = courseTitle || parseCourseNameFromFileName(file.name);

      // Create course
      const { data: course, error: courseError } = await supabaseAdmin
        .from('courses')
        .insert({
          title: courseName,
          description: courseDescription || `Khóa học được tạo tự động từ tài liệu: ${file.name}`,
          level: courseLevel || 'Beginner',
          is_active: true,
          tags: []
        })
        .select()
        .single();

      if (courseError || !course) {
        console.error('Error creating course:', courseError);
        return NextResponse.json(
          { error: 'Không thể tạo khóa học. Vui lòng thử lại.' },
          { status: 500 }
        );
      }

      console.log(`Course created: ${course.id}`);

      // Create modules and contents
      let moduleOrder = 0;
      let totalLessons = 0;

      for (const chapter of analysisResult.chapters) {
        moduleOrder++;
        
        // Create module
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
          console.error(`Error creating module for chapter ${chapter.chapterNumber}:`, moduleError);
          continue; // Skip module này nhưng tiếp tục với modules khác
        }

        console.log(`Module created: ${module.id} - ${module.title}`);

        // Create lessons (sections) for this module
        let lessonOrder = 0;
        for (const section of chapter.sections) {
          lessonOrder++;
          totalLessons++;

          try {
            // Tạo content (doc) cho bài học
            const { data: lessonContent, error: contentError } = await supabaseAdmin
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

            if (contentError || !lessonContent) {
              console.error(`Error creating lesson for section ${section.sectionNumber}:`, contentError);
              continue;
            }

            // Lưu nội dung chi tiết cho bài học từ JSON
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

          } catch (error: any) {
            console.error(`Error creating lesson:`, error);
          }
        }

      console.log(`Created ${lessonOrder} lessons for module ${module.title}`);
      }

      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
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
          lessons: totalLessons,
          totalPages: analysisResult.totalPages
        }
      });

    } catch (analysisError: any) {
      // Clean up temp file on error
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }

      console.error('Error analyzing PDF:', analysisError);
      return NextResponse.json(
        { 
          error: 'Không thể phân tích PDF. Vui lòng kiểm tra file và thử lại.',
          details: analysisError.message 
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error processing PDF:', error);
    return NextResponse.json(
      { error: 'Lỗi xử lý PDF. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}

