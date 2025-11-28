'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';
import { useCourses, useUserCourses, useEnrollCourse } from '@/hooks/use-courses';

type Course = {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  level?: string;
  created_at?: string;
};

type FilterType = 'all' | 'enrolled' | 'not-enrolled';

export default function AllCoursesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(); // ✅ Use shared state at component level
  
  // ✅ Use React Query hooks for caching & deduplication
  const { data: allCourses = [], isLoading: coursesLoading } = useCourses({
    orderBy: 'created_at',
  });
  const { data: userCourses = [], isLoading: userCoursesLoading, refetch: refetchUserCourses } = useUserCourses();
  const enrollMutation = useEnrollCourse();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [registering, setRegistering] = useState<string | null>(null);
  
  const loading = authLoading || coursesLoading || userCoursesLoading;

  // ✅ Compute enrolled IDs from cached data
  const enrolledIds = new Set(userCourses.map((uc: any) => uc.course_id || uc.courseId));
  
  // Handle authentication
  if (!authLoading && !user) {
    router.replace(ROUTES.LOGIN);
    return null;
  }

  const getFilteredCourses = () => {
    if (filter === 'enrolled') {
      return allCourses.filter(c => enrolledIds.has(c.id));
    } else if (filter === 'not-enrolled') {
      return allCourses.filter(c => !enrolledIds.has(c.id));
    }
    return allCourses;
  };

  const handleRegisterCourse = async (courseId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      router.push(ROUTES.LOGIN);
      return;
    }
    
    setRegistering(courseId);
    
    try {
      // ✅ Use mutation hook for better cache management
      await enrollMutation.mutateAsync(courseId);
      console.log('[AllCoursesPage] Course registered successfully:', courseId);
      
      // Refetch user courses to update UI
      await refetchUserCourses();
    } catch (error) {
      console.error('[AllCoursesPage] Error registering course:', error);
      alert('Đăng ký khóa học thất bại. Vui lòng thử lại.');
    } finally {
      setRegistering(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  const filteredCourses = getFilteredCourses();

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-primary rounded"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Tất cả khóa học</h1>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Tất cả ({allCourses.length})
        </button>
        <button
          onClick={() => setFilter('enrolled')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'enrolled'
              ? 'bg-primary text-primary-foreground'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Đã đăng ký ({allCourses.filter(c => enrolledIds.has(c.id)).length})
        </button>
        <button
          onClick={() => setFilter('not-enrolled')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'not-enrolled'
              ? 'bg-primary text-primary-foreground'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Chưa đăng ký ({allCourses.filter(c => !enrolledIds.has(c.id)).length})
        </button>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            {filter === 'enrolled' && 'Bạn chưa đăng ký khóa học nào.'}
            {filter === 'not-enrolled' && 'Không còn khóa học nào để đề xuất.'}
            {filter === 'all' && 'Chưa có khóa học nào.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-200"
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
                  {/* Enrolled Badge */}
                  {enrolledIds.has(course.id) && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium">
                      Đã đăng ký
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
                {enrolledIds.has(course.id) ? (
                  <Link href={ROUTES.COURSE_DETAIL(course.id)} className="mt-auto block">
                    <div className="w-full text-center py-2 px-4 bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors text-sm font-medium cursor-pointer">
                      Xem chi tiết
                    </div>
                  </Link>
                ) : (
                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={(e) => handleRegisterCourse(course.id, e)}
                      disabled={registering === course.id}
                      className="flex-1 text-center py-2 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-colors text-sm font-medium cursor-pointer"
                    >
                      {registering === course.id ? 'Đang đăng ký...' : 'Đăng ký'}
                    </button>
                    <Link href={ROUTES.COURSE_DETAIL(course.id)} className="flex-1">
                      <div className="w-full text-center py-2 px-3 border border-gray-200 text-gray-900 hover:bg-gray-50 rounded-md transition-colors text-sm font-medium cursor-pointer">
                        Xem
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

