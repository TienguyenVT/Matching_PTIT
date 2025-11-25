import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseServiceRole } from '@/lib/supabase/server';
import { requireAdminAPI } from '@/lib/auth-helpers.server';
import { analyzeStructuredJSON } from '@/lib/services/structured-json-analyzer';
import { parseCourseNameFromFileName } from '@/lib/services/pdf-analyzer';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

// Helper functions for optional quiz JSON processing
const ROMAN_MAP: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

function parseChapterIndex(chapterId: unknown, fallbackIndex: number): number {
  if (typeof chapterId === 'number' && Number.isFinite(chapterId)) {
    return chapterId;
  }
  if (typeof chapterId === 'string') {
    const trimmed = chapterId.trim().toUpperCase();
    if (ROMAN_MAP[trimmed] != null) {
      return ROMAN_MAP[trimmed];
    }
    const asNum = parseInt(trimmed, 10);
    if (!Number.isNaN(asNum)) {
      return asNum;
    }
  }
  return fallbackIndex + 1;
}

function parseQuizJSON(raw: string) {
  const json = JSON.parse(raw);
  const tests = Array.isArray(json.tests) ? json.tests : [];
  return { tests };
}

/**
 * API endpoint để xử lý JSON upload và tạo khóa học tự động
 * POST /api/admin/process-json
 */
export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Kiểm tra quyền admin
    const { user, response } = await requireAdminAPI(req);
    if (response) {
      return response; // Trả về error nếu không có quyền
    }

    // Nếu có quyền admin, lấy supabase client
    const authHeader = req.headers.get('authorization');
    const supabaseAdmin = authHeader?.startsWith('Bearer ') 
      ? supabaseServiceRole() 
      : supabaseServer();

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const quizFile = formData.get('quizFile') as File | null;
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

    // Optional quiz JSON validation & pre-parse (nếu admin upload kèm bài kiểm tra)
    let parsedQuiz: { tests: any[] } | null = null;
    if (quizFile) {
      if (!quizFile.name.toLowerCase().endsWith('.json') && quizFile.type !== 'application/json') {
        return NextResponse.json(
          { error: 'File bài kiểm tra phải là định dạng JSON.' },
          { status: 400 }
        );
      }
      if (quizFile.size > maxSize) {
        return NextResponse.json(
          { error: 'File bài kiểm tra quá lớn. Kích thước tối đa là 10MB.' },
          { status: 400 }
        );
      }

      try {
        const rawQuiz = await quizFile.text();
        parsedQuiz = parseQuizJSON(rawQuiz);
      } catch (error: any) {
        return NextResponse.json(
          { error: `Lỗi phân tích JSON bài kiểm tra: ${error.message || 'Parse error'}` },
          { status: 400 }
        );
      }

      if (!parsedQuiz.tests || parsedQuiz.tests.length === 0) {
        return NextResponse.json(
          { error: 'JSON bài kiểm tra không có mảng tests hợp lệ.' },
          { status: 400 }
        );
      }
    }

    // Save file to temp directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = path.join(tmpdir(), `upload_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, new Uint8Array(buffer));

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
    const createdModules: { id: string; chapter_number: number | null; title: string }[] = [];

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

      createdModules.push({
        id: module.id,
        chapter_number: chapter.chapterNumber,
        title: module.title,
      });

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

    // Nếu admin upload kèm file JSON bài kiểm tra, tạo luôn quiz content cho khóa học này
    let quizStats: { quizzes: number; questions: number; skippedChapters: string[] } | null = null;
    if (parsedQuiz && parsedQuiz.tests.length > 0 && createdModules.length > 0) {
      const moduleByChapter = new Map<number, { id: string; chapter_number: number | null; title: string }>();
      for (const m of createdModules) {
        if (m.chapter_number != null) {
          moduleByChapter.set(m.chapter_number, m);
        }
      }

      let createdQuizzes = 0;
      let totalQuestions = 0;
      const skippedChapters: string[] = [];

      for (let i = 0; i < parsedQuiz.tests.length; i++) {
        const chapterTest = parsedQuiz.tests[i];
        const chapterIndex = parseChapterIndex(chapterTest.chapter_id, i);
        const module = moduleByChapter.get(chapterIndex);

        if (!module) {
          if (chapterTest.chapter_id != null) {
            skippedChapters.push(String(chapterTest.chapter_id));
          }
          continue;
        }

        const rawQuestions = Array.isArray(chapterTest.questions) ? chapterTest.questions : [];
        if (!rawQuestions.length) {
          continue;
        }

        const questions = rawQuestions
          .map((q: any) => {
            if (!q || !q.question || !q.options) {
              return null;
            }
            const letters = ['A', 'B', 'C', 'D'];
            const options = letters
              .map((l) => {
                const value = q.options[l];
                return typeof value === 'string' ? value.trim() : '';
              })
              .filter((v) => v.length > 0);
            if (!options.length) {
              return null;
            }
            let correctIndex = -1;
            if (typeof q.answer === 'string') {
              const idx = letters.indexOf(q.answer.trim().toUpperCase());
              if (idx >= 0 && idx < options.length) {
                correctIndex = idx;
              }
            } else if (typeof q.answer === 'number' && q.answer >= 0 && q.answer < options.length) {
              correctIndex = q.answer;
            }
            if (correctIndex < 0) {
              correctIndex = 0;
            }
            return {
              question: String(q.question).trim(),
              options,
              correctAnswer: correctIndex,
              explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
            };
          })
          .filter((q: any) => q && q.question && q.options && q.options.length > 0);

        if (!questions.length) {
          continue;
        }

        const { data: content, error: contentError } = await supabaseAdmin
          .from('course_contents')
          .insert({
            course_id: course.id,
            module_id: module.id,
            title: chapterTest.chapter_title || `Bài kiểm tra chương ${chapterIndex}`,
            kind: 'quiz',
            order_index: 1000 + chapterIndex,
            storage_path: null,
          })
          .select()
          .single();

        if (contentError || !content) {
          continue;
        }

        const { error: quizError } = await supabaseAdmin
          .from('quiz_content')
          .insert({
            content_id: content.id,
            questions,
          });

        if (quizError) {
          continue;
        }

        createdQuizzes += 1;
        totalQuestions += questions.length;
      }

      if (createdQuizzes > 0) {
        quizStats = {
          quizzes: createdQuizzes,
          questions: totalQuestions,
          skippedChapters,
        };
      }
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
        lessons: totalLessons,
        ...(quizStats || {}),
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

