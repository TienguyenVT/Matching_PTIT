'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useCourses, useUserCourses, useEnrollCourse } from '@/hooks/use-courses';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

type Course = {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  level?: string;
  created_at?: string;
};

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Use React Query hooks for data fetching
  const { data: allCourses = [], isLoading: coursesLoading } = useCourses();
  const { data: userCourses = [], isLoading: userCoursesLoading } = useUserCourses();
  const enrollMutation = useEnrollCourse();
  
  const [registering, setRegistering] = useState<string | null>(null);
  
  const loading = authLoading || coursesLoading || userCoursesLoading;

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('[HomePage] No user found, redirecting to login');
      router.replace(ROUTES.LOGIN);
    }
  }, [user, authLoading, router]);
  
  // Compute enrolled course IDs (support both raw and transformed shapes)
  const enrolledIds = new Set(
    userCourses.map((uc: any) => uc.courseId || uc.course_id)
  );
  
  // Get enrolled courses details
  const enrolled = allCourses
    .filter(c => enrolledIds.has(c.id))
    .slice(0, 4);
  const totalEnrolled = allCourses.filter(c => enrolledIds.has(c.id)).length;
  
  // Get suggested courses (not enrolled)
  const allSuggested = allCourses.filter(c => !enrolledIds.has(c.id));
  const suggested = allSuggested.slice(0, 4);
  const totalSuggested = allSuggested.length;

  const handleRegisterCourse = async (courseId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      router.push(ROUTES.LOGIN);
      return;
    }
    
    setRegistering(courseId);
    
    try {
      await enrollMutation.mutateAsync(courseId);
      console.log('[HomePage] Course registered successfully:', courseId);
      // React Query will auto-refetch userCourses and update UI
    } catch (error) {
      console.error('[HomePage] Error registering course:', error);
      alert('Đăng ký khóa học thất bại. Vui lòng thử lại.');
    } finally {
      setRegistering(null);
    }
  };

  if (loading) {
    return (
      <div className="soft-page p-4 md:p-8">
        <div className="soft-page-inner">
          <div className="soft-card p-6">
            <p className="text-gray-500">Đang tải...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="soft-page p-4 md:p-8">
      <div className="soft-page-inner space-y-8">
      {/* Title với thanh màu đỏ bên trái */}
      <div className="soft-card px-5 py-4">
        <div className="soft-section-title">
          <div className="soft-section-title-pill" />
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Khóa học đã đăng ký</h1>
            <p className="mt-1 text-xs md:text-sm text-gray-500">Những khóa học bạn đang theo học gần đây.</p>
          </div>
        </div>
      </div>

      {/* Course Grid - Khóa học tự ôn */}
      {enrolled.length === 0 ? (
        <div className="soft-card p-8 text-center">
          <p className="text-gray-600 mb-4">Bạn chưa đăng ký khóa học nào.</p>
          <Link href="/courses" className="inline-flex items-center justify-center soft-pressable px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-colors">
            Xem các khóa học khả dụng →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
          {enrolled.map((course) => (
            <Link
              key={course.id}
              href={ROUTES.COURSE_DETAIL(course.id)}
              className="soft-card soft-pressable flex flex-col h-full overflow-hidden"
            >
              {/* Course Image */}
              <div 
                className="h-40 w-full bg-gray-200 relative overflow-hidden"
                style={{
                  backgroundImage: course.cover_url ? `url(${course.cover_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {!course.cover_url && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl">📚</span>
                  </div>
                )}
              </div>

              {/* Course Content */}
              <div className="flex flex-col flex-1 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-1 h-5 bg-primary rounded mt-1 flex-shrink-0"></div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2">{course.title}</h3>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Khóa học đang diễn ra</span>
                </div>

                <div className="mt-auto w-full text-center py-2 px-4 text-primary font-medium text-sm">
                  Xem chi tiết
                </div>
              </div>
            </Link>
          ))}
          {/* Card Xem thêm - Khóa học tự ôn */}
          {totalEnrolled > enrolled.length && (
            <Link
              href={ROUTES.ALL_COURSES}
              className="soft-card soft-pressable block overflow-hidden"
            >
              <div className="h-40 w-full bg-gray-50 relative overflow-hidden flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-gray-500 text-sm font-medium">Xem thêm</p>
                  <p className="text-gray-400 text-xs mt-1">{totalEnrolled - enrolled.length} khóa học</p>
                </div>
              </div>
              <div className="p-4">
                <div className="w-full text-center py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium">
                  Xem tất cả
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Khóa học đề xuất */}
      {suggested.length > 0 && (
        <>
          <div className="soft-card px-5 py-4">
            <div className="soft-section-title">
              <div className="soft-section-title-pill" />
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Khóa học đề xuất</h1>
                <p className="mt-1 text-xs md:text-sm text-gray-500">Gợi ý dựa trên sở thích và tiến độ học.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {suggested.map((course) => (
              <div
                key={course.id}
                className="soft-card soft-pressable flex flex-col h-full overflow-hidden"
              >
                {/* Course Image */}
                <Link href={ROUTES.COURSE_DETAIL(course.id)}>
                  <div 
                    className="h-40 w-full bg-gray-200 relative overflow-hidden cursor-pointer"
                    style={{
                      backgroundImage: course.cover_url ? `url(${course.cover_url})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!course.cover_url && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl">📚</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Course Content */}
                <div className="flex flex-col flex-1 p-4">
                  <Link href={ROUTES.COURSE_DETAIL(course.id)}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-1 h-5 bg-primary rounded mt-1 flex-shrink-0"></div>
                      <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-primary transition-colors">{course.title}</h3>
                    </div>
                  </Link>
                  
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{course.description}</p>

                  {/* Button Actions */}
                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={(e) => handleRegisterCourse(course.id, e)}
                      disabled={registering === course.id}
                      className="flex-1 text-center py-2 px-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-medium cursor-pointer"
                    >
                      {registering === course.id ? 'Đang đăng ký...' : 'Đăng ký'}
                    </button>
                    <Link href={ROUTES.COURSE_DETAIL(course.id)} className="flex-1">
                      <div className="w-full text-center py-2 px-3 border border-gray-200 text-gray-900 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer">
                        Xem
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {/* Card Xem thêm - Khóa học đề xuất */}
            {totalSuggested > suggested.length && (
              <Link
                href={ROUTES.ALL_COURSES}
                className="soft-card soft-pressable block overflow-hidden"
              >
                <div className="h-40 w-full bg-gray-50 relative overflow-hidden flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-gray-500 text-sm font-medium">Xem thêm</p>
                    <p className="text-gray-400 text-xs mt-1">{totalSuggested - suggested.length} khóa học</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="w-full text-center py-2 px-4 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors text-sm font-medium">
                    Xem tất cả
                  </div>
                </div>
              </Link>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
