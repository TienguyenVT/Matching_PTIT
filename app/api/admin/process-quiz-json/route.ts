import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseServiceRole } from '@/lib/supabase/server';
import { requireAdminAPI } from '@/lib/auth-helpers.server';

function parseQuizJSON(raw: string) {
  const json = JSON.parse(raw);
  const tests = Array.isArray(json.tests) ? json.tests : [];
  return { tests };
}

function parseCourseTitleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.json$/i, '')
    .replace(/_Test$/i, '')
    .trim();
}

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

export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAdminAPI(req);
    if (response) {
      return response;
    }

    const authHeader = req.headers.get('authorization');
    const supabaseAdmin = authHeader?.startsWith('Bearer ')
      ? supabaseServiceRole()
      : supabaseServer();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const courseId = (formData.get('courseId') as string | null) || null;
    const courseTitleInput = (formData.get('courseTitle') as string | null) || null;

    if (!file) {
      return NextResponse.json(
        { error: 'Không có file được upload.' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      return NextResponse.json(
        { error: 'File phải là định dạng JSON.' },
        { status: 400 }
      );
    }

    const raw = await file.text();
    let parsed;
    try {
      parsed = parseQuizJSON(raw);
    } catch (error: any) {
      return NextResponse.json(
        { error: `JSON bài kiểm tra không hợp lệ: ${error.message || 'Parse error'}` },
        { status: 400 }
      );
    }

    if (!parsed.tests || parsed.tests.length === 0) {
      return NextResponse.json(
        { error: 'JSON không có mảng tests hợp lệ.' },
        { status: 400 }
      );
    }

    let course: { id: string; title: string } | null = null;
    if (courseId) {
      const { data, error } = await supabaseAdmin
        .from('courses')
        .select('id, title')
        .eq('id', courseId)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json(
          { error: 'Không tìm thấy khóa học với courseId đã cung cấp.' },
          { status: 404 }
        );
      }
      course = data as { id: string; title: string };
    } else {
      const inferredTitle = courseTitleInput || parseCourseTitleFromFileName(file.name);
      if (!inferredTitle) {
        return NextResponse.json(
          { error: 'Không xác định được tên khóa học để gắn bài kiểm tra.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabaseAdmin
        .from('courses')
        .select('id, title')
        .eq('title', inferredTitle)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json(
          { error: `Không tìm thấy khóa học với tên "${inferredTitle}". Vui lòng kiểm tra lại.` },
          { status: 404 }
        );
      }
      course = data as { id: string; title: string };
    }

    if (!course) {
      return NextResponse.json(
        { error: 'Không tìm thấy khóa học để gắn bài kiểm tra.' },
        { status: 404 }
      );
    }

    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('course_modules')
      .select('id, chapter_number, title')
      .eq('course_id', course.id)
      .order('chapter_number');

    if (modulesError || !modules || modules.length === 0) {
      return NextResponse.json(
        { error: 'Khóa học chưa có học phần (course_modules) để gắn bài kiểm tra.' },
        { status: 400 }
      );
    }

    const moduleByChapter = new Map<number, { id: string; chapter_number: number | null; title: string }>();
    for (const m of modules as any[]) {
      if (m.chapter_number != null) {
        moduleByChapter.set(m.chapter_number, m);
      }
    }

    let createdQuizzes = 0;
    let totalQuestions = 0;
    const skippedChapters: string[] = [];

    for (let i = 0; i < parsed.tests.length; i++) {
      const chapterTest = parsed.tests[i];
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

    if (!createdQuizzes) {
      return NextResponse.json(
        {
          error: 'Không tạo được bài kiểm tra nào từ file JSON. Vui lòng kiểm tra lại cấu trúc file và mapping chương.',
          skippedChapters,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
      },
      statistics: {
        quizzes: createdQuizzes,
        questions: totalQuestions,
        skippedChapters,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Lỗi xử lý JSON bài kiểm tra: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
