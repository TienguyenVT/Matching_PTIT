'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

type Course = {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  level?: string;
};

type CourseContent = {
  id: string;
  title: string;
  kind: 'video' | 'doc' | 'quiz';
  storage_path?: string;
  order_index: number;
};

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  console.log('[DetailPage] Component rendering...');
  const router = useRouter();
  const courseId = params.courseId;
  console.log('[DetailPage] courseId from params:', courseId);
  const supabase = supabaseBrowser();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [contents, setContents] = useState<CourseContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<CourseContent | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'knowledge' | 'exercises' | 'products' | 'report'>('knowledge');

  useEffect(() => {
    const load = async () => {
      console.log('[DetailPage] Starting load, courseId:', courseId);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[DetailPage] Auth error:', authError);
      }
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
      if (contentsData && contentsData.length > 0) {
        setSelectedContent(contentsData[0]);
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
  }, [courseId, router, supabase]);

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

  // Group contents by modules (tạm thời phân nhóm theo logic đơn giản)
  const groupedModules = contents.reduce((acc, content) => {
    const moduleIndex = Math.floor(content.order_index / 3) + 1;
    const moduleKey = `module-${moduleIndex}`;
    if (!acc[moduleKey]) {
      acc[moduleKey] = {
        id: moduleKey,
        title: `Học phần ${moduleIndex} - ${content.title.split(' ').slice(0, 5).join(' ')}`,
        contents: []
      };
    }
    acc[moduleKey].contents.push(content);
    return acc;
  }, {} as Record<string, { id: string; title: string; contents: CourseContent[] }>);

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
      const module = Object.values(groupedModules).find(m => 
        m.contents.some(c => c.id === selectedContent.id)
      );
      return module ? module.title : selectedContent.title;
    }
    return 'ÔN TẬP'; // Giá trị mặc định
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
              {Object.values(groupedModules).length === 0 ? (
                <p className="text-gray-500 text-sm">Chưa có nội dung</p>
              ) : (
                Object.values(groupedModules).map((module) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-gray-700">{module.title}</span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${
                          expandedModules.has(module.id) ? 'rotate-180' : ''
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
                            className={`w-full text-left p-2 rounded text-sm ${
                              selectedContent?.id === content.id
                                ? 'bg-green-50 text-green-700'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-10 mb-6">
              <button className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-xs">Xem kiến thức</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs">Làm bài kiểm tra</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs">Ghép đôi học tập</span>
              </button>
            </div>

            {activeTab === 'knowledge' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="font-medium text-gray-800">Nội dung bài học</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    {selectedContent ? (
                      <p className="text-gray-700">{selectedContent.title}</p>
                    ) : (
                      <p className="text-gray-500 text-sm">Nội dung bài học đang được cập nhật</p>
                    )}
                  </div>
                </div>
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

