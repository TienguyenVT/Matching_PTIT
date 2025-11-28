'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

type Course = {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  level?: string;
};

type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  chapter_number: number | null;
  description: string | null;
  order_index: number;
};

type CourseContent = {
  id: string;
  title: string;
  kind: 'video' | 'doc' | 'quiz';
  storage_path?: string;
  order_index: number;
  module_id: string | null;
};

type LessonContent = {
  content_id: string;
  content_text: string;
};

type QuizContent = {
  content_id: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
};

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  console.log('[DetailPage] Component rendering...');
  const router = useRouter();
  const courseId = params.courseId;
  console.log('[DetailPage] courseId from params:', courseId);
  const supabase = supabaseBrowser();
  const { user } = useAuth(); // ✅ Use shared auth state

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [contents, setContents] = useState<CourseContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<CourseContent | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [quizContent, setQuizContent] = useState<QuizContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'knowledge' | 'exercises' | 'products' | 'report'>('knowledge');
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizSummary, setQuizSummary] = useState<{ correct: number[]; incorrect: number[] }>({ correct: [], incorrect: [] });
  const [completedContentIds, setCompletedContentIds] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      console.log('[DetailPage] Starting load, courseId:', courseId);

      // ✅ Use user from shared state instead of duplicate API call
      if (!user) {
        console.log('[DetailPage] No user found, redirecting to login');
        router.replace(ROUTES.LOGIN);
        return;
      }
      console.log('[DetailPage] User authenticated:', user.id);

      // Load course
      console.log('[DetailPage] Loading course from database...');
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) {
        console.error('[DetailPage] Error loading course:', courseError);
      } else {
        console.log('[DetailPage] Course loaded:', courseData?.title || 'null');
      }

      setCourse(courseData);

      // Load modules
      console.log('[DetailPage] Loading course modules...');
      const { data: modulesData, error: modulesError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (modulesError) {
        console.error('[DetailPage] Error loading modules:', modulesError);
      } else {
        console.log('[DetailPage] Modules loaded:', modulesData?.length || 0, 'modules');
      }

      // Load contents
      console.log('[DetailPage] Loading course contents...');
      const { data: contentsData, error: contentsError } = await supabase
        .from('course_contents')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (contentsError) {
        console.error('[DetailPage] Error loading contents:', contentsError);
      } else {
        console.log('[DetailPage] Contents loaded:', contentsData?.length || 0, 'items');
      }

      const safeModules = (modulesData || []) as CourseModule[];
      const safeContents = (contentsData || []) as CourseContent[];

      // Load learning progress for this user & course (optional if table exists)
      let initialCompletedIds: string[] = [];
      try {
        const { data: progressData, error: progressError } = await supabase
          .from('user_content_progress')
          .select('content_id, is_completed')
          .eq('user_id', user.id)
          .eq('course_id', courseId);

        if (progressError) {
          console.warn('[DetailPage] Error loading learning progress (optional):', progressError);
        } else if (progressData) {
          initialCompletedIds = (progressData as any[])
            .filter((row) => (row as any).is_completed)
            .map((row) => (row as any).content_id as string)
            .filter(Boolean);
        }
      } catch (progressErr) {
        console.warn('[DetailPage] Exception while loading learning progress (optional):', progressErr);
      }

      setModules(safeModules);
      setContents(safeContents);
      setCompletedContentIds(initialCompletedIds);

      // Set first content as selected theo đúng thứ tự chương/bài, ưu tiên doc/video trước quiz
      if (safeModules.length > 0 && safeContents.length > 0) {
        const initialGrouped = safeModules
          .map((module) => ({
            ...module,
            contents: safeContents
              .filter((content) => content.module_id === module.id)
              .sort((a, b) => a.order_index - b.order_index),
          }))
          .filter((module) => module.contents.length > 0)
          .sort((a, b) => a.order_index - b.order_index);

        if (initialGrouped.length > 0) {
          const firstModule = initialGrouped[0];
          const docsAndVideos = firstModule.contents.filter(
            (c) => c.kind === 'doc' || c.kind === 'video'
          );
          const firstContent =
            docsAndVideos.length > 0 ? docsAndVideos[0] : firstModule.contents[0];

          setSelectedContent(firstContent);
          setExpandedModules(new Set([firstModule.id]));
        } else if (safeContents.length > 0) {
          // Fallback: chọn phần tử đầu tiên nếu không nhóm được theo module
          setSelectedContent(safeContents[0]);
        }
      } else if (safeContents.length > 0) {
        setSelectedContent(safeContents[0]);
      } else if (safeModules.length > 0) {
        // Auto-expand first module nếu chưa có nội dung
        setExpandedModules(new Set([safeModules[0].id]));
      }

      // Check if enrolled
      console.log('[DetailPage] Checking enrollment...');
      const { data: enrolled, error: enrolledError } = await supabase
        .from('user_courses')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (enrolledError) {
        console.error('[DetailPage] Error checking enrollment:', enrolledError);
      } else {
        console.log('[DetailPage] Is enrolled:', !!enrolled);
      }
      setIsEnrolled(!!enrolled);

      console.log('[DetailPage] Load complete');
      setLoading(false);
    };
    load();
  }, [courseId, router, supabase, user]); // ✅ Add user to dependencies

  // Load content details khi selectedContent thay đổi
  const loadContentDetails = async (contentId: string, kind: 'video' | 'doc' | 'quiz') => {
    setLoadingContent(true);
    try {
      if (kind === 'doc') {
        // Load lesson content
        const { data, error } = await supabase
          .from('lesson_content')
          .select('*')
          .eq('content_id', contentId)
          .maybeSingle();

        if (error) {
          console.error('Error loading lesson content:', error);
        } else {
          setLessonContent(data);
          setQuizContent(null);
          setUserAnswers([]);
          setShowQuizResults(false);
          setQuizScore(null);
          setQuizSummary({ correct: [], incorrect: [] });
        }
      } else if (kind === 'quiz') {
        // Load quiz content
        const { data, error } = await supabase
          .from('quiz_content')
          .select('*')
          .eq('content_id', contentId)
          .maybeSingle();

        if (error) {
          console.error('Error loading quiz content:', error);
        } else {
          if (data) {
            const quizData = data as QuizContent;
            setQuizContent(quizData);
            const questions = quizData.questions || [];
            setUserAnswers(new Array(questions.length).fill(-1));
          } else {
            setQuizContent(null);
            setUserAnswers([]);
          }
          setLessonContent(null);
          setShowQuizResults(false);
          setQuizScore(null);
          setQuizSummary({ correct: [], incorrect: [] });
        }
      } else {
        // Video: không có content chi tiết
        setLessonContent(null);
        setQuizContent(null);
        setUserAnswers([]);
        setShowQuizResults(false);
        setQuizScore(null);
        setQuizSummary({ correct: [], incorrect: [] });
      }
    } catch (error) {
      console.error('Error loading content details:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  // Load content khi selectedContent thay đổi
  useEffect(() => {
    if (selectedContent) {
      loadContentDetails(selectedContent.id, selectedContent.kind);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContent?.id]);

  const handleRegister = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace(ROUTES.LOGIN);
      return;
    }

    try {
      const res = await fetch('/api/register-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ courseId })
      });

      const data = await res.json();

      if (res.ok) {
        setIsEnrolled(true);
        alert('Đăng ký thành công!');
      } else {
        alert(data.error || 'Đăng ký thất bại');
      }
    } catch (error) {
      console.error('Register error:', error);
      alert('Có lỗi xảy ra khi đăng ký khóa học');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Không tìm thấy khóa học</h1>
          <Link href="/home" className="text-primary hover:opacity-90">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  // Group contents by modules
  const groupedModules = modules
    .map((courseModule) => ({
      ...courseModule,
      contents: contents
        .filter((content) => content.module_id === courseModule.id)
        .sort((a, b) => a.order_index - b.order_index),
    }))
    .filter((courseModule) => courseModule.contents.length > 0);

  const orderedModules = [...groupedModules].sort((a, b) => a.order_index - b.order_index);

  const flatContents: CourseContent[] = orderedModules.flatMap((courseModule) => {
    const docsAndVideos = courseModule.contents
      .filter((c) => c.kind === 'doc' || c.kind === 'video')
      .sort((a, b) => a.order_index - b.order_index);
    const quizzes = courseModule.contents
      .filter((c) => c.kind === 'quiz')
      .sort((a, b) => a.order_index - b.order_index);
    return [...docsAndVideos, ...quizzes];
  });

  const findIndexById = (id: string | null | undefined) =>
    id ? flatContents.findIndex((c) => c.id === id) : -1;

  const currentIndex = findIndexById(selectedContent?.id);

  const highestCompletedIndex =
    flatContents.length === 0 || completedContentIds.length === 0
      ? -1
      : Math.max(
          -1,
          ...completedContentIds
            .map((id) => findIndexById(id))
            .filter((idx) => idx >= 0)
        );

  const unlockedUntilIndex =
    flatContents.length > 0
      ? Math.min(
          Math.max(highestCompletedIndex + 1, 0),
          flatContents.length - 1
        )
      : -1;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < flatContents.length - 1;

  const canSelectContent = (content: CourseContent) => {
    const idx = findIndexById(content.id);
    return idx <= unlockedUntilIndex;
  };

  const goToContent = (target: CourseContent | null) => {
    if (!target) return;
    if (!canSelectContent(target)) {
      alert('Bạn cần hoàn thành các bài học trước đó trước khi truy cập nội dung này.');
      return;
    }
    setSelectedContent(target);
    setActiveTab('knowledge');
  };

  const goToPrev = () => {
    if (!hasPrev) return;
    const target = flatContents[currentIndex - 1];
    setSelectedContent(target);
    setActiveTab('knowledge');
  };

  const persistCompletion = async (
    content: CourseContent,
    score: number | null = null,
    shouldNotify: boolean = false,
  ) => {
    try {
      if (!user) return;

      const payload: any = {
        user_id: user.id,
        course_id: courseId,
        content_id: content.id,
        is_completed: true,
        last_attempt_at: new Date().toISOString(),
      };

      if (score !== null) {
        payload.last_score = score;
      }

      const { error } = await supabase
        .from('user_content_progress')
        .upsert(payload, { onConflict: 'user_id,course_id,content_id' });

      if (error) {
        console.error('[DetailPage] Error saving learning progress:', error);
        return;
      }

      if (shouldNotify) {
        try {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              title: 'Hoàn thành bài học',
              message: course?.title
                ? `Bạn đã hoàn thành "${content.title}" trong khóa "${course.title}".`
                : `Bạn đã hoàn thành bài học "${content.title}".`,
              type: 'lesson_completed',
              read: false,
              metadata: {
                course_id: courseId,
                content_id: content.id,
              },
            });

          if (notifError) {
            console.error('[DetailPage] Error creating completion notification:', notifError);
          }
        } catch (notifErr) {
          console.error('[DetailPage] Exception while creating completion notification:', notifErr);
        }
      }
    } catch (err) {
      console.error('[DetailPage] Exception while saving learning progress:', err);
    }
  };

  const markCurrentContentCompleted = (score: number | null = null) => {
    if (!selectedContent) return;
    const idx = findIndexById(selectedContent.id);
    if (idx < 0) return;

    const alreadyCompleted = completedContentIds.includes(selectedContent.id);
    if (!alreadyCompleted) {
      setCompletedContentIds((prev) => [...prev, selectedContent.id]);
    }

    // Fire-and-forget persistence to server; chỉ tạo notification lần đầu hoàn thành
    persistCompletion(selectedContent, score, !alreadyCompleted);
  };

  const isNextLocked =
    hasNext && currentIndex + 1 > unlockedUntilIndex;

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // Tìm module chứa selectedContent để hiển thị tên
  const getCurrentModuleTitle = () => {
    if (selectedContent) {
      const currentModule = groupedModules.find((m) =>
        m.contents.some((c) => c.id === selectedContent.id)
      );
      return currentModule ? currentModule.title : selectedContent.title;
    }
    return 'ÔN TẬP'; // Giá trị mặc định
  };

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    setUserAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  const handleSubmitQuiz = () => {
    if (!quizContent || !quizContent.questions || quizContent.questions.length === 0) {
      return;
    }

    const total = quizContent.questions.length;
    const correctQuestions: number[] = [];
    const incorrectQuestions: number[] = [];

    quizContent.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        correctQuestions.push(idx + 1);
      } else {
        incorrectQuestions.push(idx + 1);
      }
    });

    const correctCount = correctQuestions.length;
    const scoreOn10 = total > 0 ? (correctCount / total) * 10 : 0;

    setQuizScore(scoreOn10);
    setQuizSummary({ correct: correctQuestions, incorrect: incorrectQuestions });
    setShowQuizResults(true);
    markCurrentContentCompleted(scoreOn10);
  };

  const startQuizForCurrentModule = () => {
    if (!selectedContent) {
      return;
    }

    const currentModule = groupedModules.find((m) =>
      m.contents.some((c) => c.id === selectedContent.id)
    );

    if (!currentModule) {
      return;
    }

    const quizForModule = currentModule.contents.find((c) => c.kind === 'quiz');

    if (!quizForModule) {
      alert('Chưa có bài kiểm tra cho chương này.');
      return;
    }

    const quizIndex = flatContents.findIndex((c) => c.id === quizForModule.id);
    if (quizIndex > unlockedUntilIndex && quizIndex !== -1) {
      alert('Bạn cần học xong toàn bộ nội dung chương này trước khi làm bài kiểm tra.');
      return;
    }

    setSelectedContent(quizForModule);
    setActiveTab('knowledge');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 md:py-10">
      <div className="max-w-10xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Left Sidebar - Chương trình học */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-primary rounded-full"></div>
              <h2 className="text-base font-semibold text-gray-800">Chương trình học</h2>
            </div>
            <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
              {groupedModules.length === 0 ? (
                <p className="text-gray-500 text-sm">Chưa có nội dung</p>
              ) : (
                groupedModules.map((courseModule) => (
                  <div key={courseModule.id} className="border border-gray-200 rounded-xl">
                    <button
                      onClick={() => toggleModule(courseModule.id)}
                      className="w-full text-left p-2.5 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-gray-800">{courseModule.title}</span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${
                          expandedModules.has(courseModule.id) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedModules.has(courseModule.id) && (
                      <div className="px-2.5 pb-2 space-y-1">
                        {courseModule.contents.map((content) => {
                          const contentIndex = flatContents.findIndex((c) => c.id === content.id);
                          const isLocked = contentIndex !== -1 && contentIndex > unlockedUntilIndex;
                          const isActive = selectedContent?.id === content.id;
                          return (
                            <button
                              key={content.id}
                              onClick={() => {
                                if (!isLocked) {
                                  goToContent(content);
                                } else {
                                  alert('Vui lòng hoàn thành các bài học trước đó trước khi mở bài này.');
                                }
                              }}
                              disabled={isLocked}
                              className={`w-full text-left p-1.5 rounded text-xs ${
                                isActive
                                  ? 'bg-red-50 text-red-700'
                                  : isLocked
                                  ? 'text-gray-400 cursor-not-allowed opacity-60'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span className="mr-1 text-xs uppercase">
                                {isLocked
                                  ? '🔒'
                                  : content.kind === 'doc'
                                  ? '📄'
                                  : content.kind === 'quiz'
                                  ? '📝'
                                  : '🎥'}
                              </span>
                              {content.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Main Content - ÔN TẬP */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <p className="text-2xs font-semibold tracking-wide text-primary uppercase">Khóa học</p>
                <h1 className="text-lg md:text-4xl font-bold text-gray-900">{course?.title}</h1>
                {course?.description && (
                  <p className="text-xs text-gray-600 max-w-2xl">{course.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEnrolled && (
                  <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                    Đã tham gia
                  </span>
                )}
                {/* Chỉ giữ lại button Ghép đôi học tập */}
                <button
                  onClick={() => router.push(ROUTES.ALL_MEMBER)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:shadow-md hover:opacity-90 transition-all"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  <span className="text-xs">Ghép đôi học tập</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <h2 className="text-xs font-semibold text-gray-800">{getCurrentModuleTitle()}</h2>
              </div>
              {selectedContent && (
                <p className="text-xs text-gray-500">
                  Nội dung hiện tại:{' '}
                  <span className="font-medium text-gray-800">{selectedContent.title}</span>
                </p>
              )}
            </div>

            {/* Nội dung kiến thức / quiz / video */}
            <div className="space-y-6">
              {loadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-gray-600">Đang tải nội dung...</span>
                </div>
              ) : selectedContent?.kind === 'doc' && lessonContent ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="font-medium text-gray-800">Nội dung bài học</h3>
                  </div>
                  <div
                    className="bg-white rounded-xl p-6 prose-content"
                    dangerouslySetInnerHTML={{ __html: lessonContent.content_text }}
                    style={{ lineHeight: '1.75' }}
                  />
                </div>
              ) : selectedContent?.kind === 'quiz' && quizContent ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <h3 className="font-medium text-gray-800">Bài kiểm tra trắc nghiệm</h3>
                  </div>
                  <div className="bg-white rounded-xl p-6 space-y-6">
                    {quizContent.questions.map((q, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-red-500 text-red-100 rounded-full flex items-center justify-center text-sm font-medium">
                            {idx + 1}
                          </span>
                          <p className="font-medium text-gray-800 flex-1">{q.question}</p>
                        </div>
                        <div className="ml-8 space-y-2">
                          {q.options.map((option, optIdx) => (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                                showQuizResults
                                  ? optIdx === q.correctAnswer
                                    ? 'bg-green-50 border border-green-200'
                                    : userAnswers[idx] === optIdx
                                    ? 'bg-red-50 border border-red-200'
                                    : 'hover:bg-gray-50'
                                  : userAnswers[idx] === optIdx
                                  ? 'bg-red-50 border border-red-200'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`question-${idx}`}
                                value={optIdx}
                                checked={userAnswers[idx] === optIdx}
                                disabled={showQuizResults}
                                onChange={() => handleSelectAnswer(idx, optIdx)}
                                className="text-red-500"
                              />
                              <span
                                className={`${
                                  showQuizResults
                                    ? optIdx === q.correctAnswer
                                      ? 'font-medium text-green-700'
                                      : userAnswers[idx] === optIdx
                                      ? 'font-medium text-red-700'
                                      : 'text-gray-700'
                                    : userAnswers[idx] === optIdx
                                    ? 'font-medium text-red-700'
                                    : 'text-gray-700'
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}. {option}
                              </span>
                              {showQuizResults && optIdx === q.correctAnswer && (
                                <span className="ml-auto text-green-600 text-sm">✓ Đáp án đúng</span>
                              )}
                            </label>
                          ))}
                        </div>
                        {showQuizResults && q.explanation && (
                          <div className="ml-8 mt-3 p-3 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-800">
                              <strong>Giải thích:</strong> {q.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="mt-6 flex flex-col gap-4 border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={handleSubmitQuiz}
                          disabled={showQuizResults || quizContent.questions.length === 0}
                          className="px-4 py-2 bg-red-500 text-red-100 text-sm font-medium rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Nộp bài và xem kết quả
                        </button>
                        {showQuizResults && quizScore !== null && (
                          <div className="text-right text-sm">
                            <p className="font-semibold text-gray-800">
                              Điểm: <span className="text-green-700">{quizScore.toFixed(1)} / 10</span>
                            </p>
                            <p className="text-gray-600">
                              Đúng {quizSummary.correct.length}/{quizContent.questions.length} câu
                            </p>
                          </div>
                        )}
                      </div>
                      {showQuizResults && (
                        <div className="text-sm text-gray-700 space-y-1">
                          <p>
                            Câu đúng:{' '}
                            {quizSummary.correct.length > 0 ? quizSummary.correct.join(', ') : 'Không có'}
                          </p>
                          <p>
                            Câu sai:{' '}
                            {quizSummary.incorrect.length > 0 ? quizSummary.incorrect.join(', ') : 'Không có'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedContent?.kind === 'video' ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <h3 className="font-medium text-gray-800">Video bài học</h3>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6">
                    {selectedContent.storage_path ? (
                      <video src={selectedContent.storage_path} controls className="w-full rounded-md bg-black" />
                    ) : (
                      <p className="text-gray-500 text-sm">Video chưa được cập nhật</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-6">
                  <p className="text-gray-500 text-sm">Nội dung bài học đang được cập nhật</p>
                </div>
              )}

              {/* Điều hướng bài học trước / tiếp theo */}
              {!loadingContent && flatContents.length > 0 && currentIndex >= 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={goToPrev}
                    disabled={!hasPrev}
                    className="px-4 py-2 text-sm rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Bài trước
                  </button>
                  <span className="text-xs text-gray-500">
                    Bài {currentIndex + 1} / {flatContents.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasNext) return;
                      const nextContent = flatContents[currentIndex + 1];
                      if (!nextContent) return;

                      if (selectedContent?.kind === 'doc' || selectedContent?.kind === 'video') {
                        // Đánh dấu đã hoàn thành bài hiện tại rồi chuyển sang bài tiếp theo
                        markCurrentContentCompleted();
                        setSelectedContent(nextContent);
                        setActiveTab('knowledge');
                        return;
                      }

                      const idxNext = currentIndex + 1;
                      const lockedNext = idxNext > unlockedUntilIndex;
                      if (lockedNext) {
                        alert('Bạn cần hoàn thành nội dung hiện tại trước khi sang bài tiếp theo.');
                        return;
                      }

                      setSelectedContent(nextContent);
                      setActiveTab('knowledge');
                    }}
                    disabled={
                      !hasNext ||
                      loadingContent ||
                      (selectedContent?.kind === 'quiz' && isNextLocked)
                    }
                    className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Bài tiếp theo
                  </button>
                </div>
              )}
            </div>

            {/* Các tab khác hiện vẫn giữ code nhưng sẽ không được kích hoạt nếu không thay đổi activeTab */}
            {activeTab === 'exercises' && (
              <div className="text-center py-12">
                <p className="text-gray-500">Nội dung bài tập đang được cập nhật</p>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="text-center py-12">
                <p className="text-gray-500">Sản phẩm buổi học đang được cập nhật</p>
              </div>
            )}

            {activeTab === 'report' && (
              <div className="text-center py-12">
                <p className="text-gray-500">Báo cáo buổi học đang được cập nhật</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

