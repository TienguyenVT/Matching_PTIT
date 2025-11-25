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

      setModules(modulesData || []);

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

      setContents(contentsData || []);

      // Set first content as selected (loadContentDetails sẽ được gọi tự động qua useEffect)
      if (contentsData && contentsData.length > 0) {
        setSelectedContent(contentsData[0]);
      } else if (modulesData && modulesData.length > 0) {
        // Auto-expand first module
        setExpandedModules(new Set([modulesData[0].id]));
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
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
          <Link href="/home" className="text-teal-600 hover:underline">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  // Group contents by modules
  const groupedModules = modules.map(module => ({
    ...module,
    contents: contents
      .filter(content => content.module_id === module.id)
      .sort((a, b) => a.order_index - b.order_index)
  })).filter(module => module.contents.length > 0);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
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
      const module = groupedModules.find(m =>
        m.contents.some(c => c.id === selectedContent.id)
      );
      return module ? module.title : selectedContent.title;
    }
    return 'ÔN TẬP'; // Giá trị mặc định
  };

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    setUserAnswers(prev => {
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
  };

  const startQuizForCurrentModule = () => {
    if (!selectedContent) {
      return;
    }

    const currentModule = groupedModules.find(m =>
      m.contents.some(c => c.id === selectedContent.id)
    );

    if (!currentModule) {
      return;
    }

    const quizForModule = currentModule.contents.find(c => c.kind === 'quiz');

    if (!quizForModule) {
      alert('Chưa có bài kiểm tra cho chương này.');
      return;
    }

    setSelectedContent(quizForModule);
    setActiveTab('knowledge');
  };

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Chương trình học */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-green-500 rounded"></div>
              <h2 className="text-lg font-semibold text-gray-800">Chương trình học</h2>
            </div>
            <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
              {groupedModules.length === 0 ? (
                <p className="text-gray-500 text-sm">Chưa có nội dung</p>
              ) : (
                groupedModules.map((module) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-gray-700">{module.title}</span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${expandedModules.has(module.id) ? 'rotate-180' : ''
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedModules.has(module.id) && (
                      <div className="px-3 pb-2 space-y-1">
                        {module.contents.map((content) => (
                          <button
                            key={content.id}
                            onClick={() => setSelectedContent(content)}
                            className={`w-full text-left p-2 rounded text-sm ${selectedContent?.id === content.id
                              ? 'bg-green-50 text-green-700'
                              : 'text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            <span className="mr-1 text-xs uppercase">{content.kind === 'doc' ? '📄' : content.kind === 'quiz' ? '📝' : '🎥'}</span>
                            {content.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Main Content - ÔN TẬP */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-green-500 rounded"></div>
                <h2 className="text-lg font-semibold text-gray-800">{getCurrentModuleTitle()}</h2>
              </div>
              {isEnrolled && (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                  Đã tham gia
                </span>
              )}
            </div>

            <div className="space-y-2 mb-6">
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-1">Nội dung buổi học</p>
                <p className="text-sm font-medium text-gray-800">{selectedContent?.title}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <button
                onClick={() => setActiveTab('knowledge')}
                className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-xs">Xem kiến thức</span>
              </button>
              <button
                onClick={() => setActiveTab('exercises')}
                className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs">Làm bài tập</span>
              </button>
              <button
                onClick={startQuizForCurrentModule}
                className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs">Làm bài kiểm tra</span>
              </button>
              <button
                onClick={() => router.push(ROUTES.ALL_MEMBER)}
                className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs">Ghép đôi học tập</span>
              </button>
            </div>

            {activeTab === 'knowledge' && (
              <div className="space-y-6">
                {loadingContent ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    <span className="ml-3 text-gray-600">Đang tải nội dung...</span>
                  </div>
                ) : selectedContent?.kind === 'doc' && lessonContent ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="font-medium text-gray-800">Nội dung bài học</h3>
                    </div>
                    <div
                      className="bg-white rounded-lg p-6 prose-content"
                      dangerouslySetInnerHTML={{ __html: lessonContent.content_text }}
                      style={{
                        lineHeight: '1.75',
                      }}
                    />
                  </div>
                ) : selectedContent?.kind === 'quiz' && quizContent ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <h3 className="font-medium text-gray-800">Bài kiểm tra trắc nghiệm</h3>
                    </div>
                    <div className="bg-white rounded-lg p-6 space-y-6">
                      {quizContent.questions.map((q, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-2 mb-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
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
                                      ? 'bg-teal-50 border border-teal-200'
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
                                  className="text-teal-600"
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
                                        ? 'font-medium text-teal-700'
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
                            <div className="ml-8 mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-sm text-blue-800">
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
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <h3 className="font-medium text-gray-800">Video bài học</h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-6">
                      {selectedContent.storage_path ? (
                        <video src={selectedContent.storage_path} controls className="w-full rounded-md bg-black" />
                      ) : (
                        <p className="text-gray-500 text-sm">Video chưa được cập nhật</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <p className="text-gray-500 text-sm">Nội dung bài học đang được cập nhật</p>
                  </div>
                )}
              </div>
            )}

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

