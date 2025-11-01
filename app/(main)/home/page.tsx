'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
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
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [enrolled, setEnrolled] = useState<Course[]>([]);
  const [suggested, setSuggested] = useState<Course[]>([]);
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [totalSuggested, setTotalSuggested] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      console.log('[HomePage] Starting load...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        console.log('[HomePage] No user found, redirecting to login');
        router.replace(ROUTES.LOGIN); 
        return; 
      }
      console.log('[HomePage] User authenticated:', user.id);

      // Lấy các khóa học đã đăng ký
      console.log('[HomePage] Fetching enrolled course IDs...');
      const { data: myIds, error: idsError } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', user.id);
      
      if (idsError) {
        console.error('[HomePage] Error fetching enrolled IDs:', idsError);
      }
      
      const enrolledIdsSet = new Set((myIds ?? []).map((r: any) => r.course_id));
      console.log('[HomePage] Enrolled course IDs:', enrolledIdsSet.size);
      setEnrolledIds(enrolledIdsSet);

      if (enrolledIdsSet.size > 0) {
        const { data: myCourses, error: coursesError } = await supabase
          .from('courses')
          .select('id,title,description,cover_url,level,created_at')
          .in('id', Array.from(enrolledIdsSet))
          .order('created_at', { ascending: false });
        
        if (coursesError) {
          console.error('[HomePage] Error fetching enrolled courses:', coursesError);
        } else {
          console.log('[HomePage] Enrolled courses loaded:', myCourses?.length || 0);
        }
        
        const allEnrolled = myCourses ?? [];
        setTotalEnrolled(allEnrolled.length);
        setEnrolled(allEnrolled.slice(0, 4)); // Chỉ hiển thị 4 khóa học đầu tiên
      }

      // Lấy các khóa học chưa đăng ký (đề xuất)
      console.log('[HomePage] Fetching all active courses...');
      const { data: allActive, error: allActiveError } = await supabase
        .from('courses')
        .select('id,title,description,cover_url,level,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (allActiveError) {
        console.error('[HomePage] Error fetching all active courses:', allActiveError);
      } else {
        console.log('[HomePage] All active courses loaded:', allActive?.length || 0);
      }

      const allSuggested = (allActive ?? []).filter(
        (c: any) => !enrolledIdsSet.has(c.id)
      );
      
      setTotalSuggested(allSuggested.length);
      setSuggested(allSuggested.slice(0, 4)); // Chỉ hiển thị 4 khóa học đầu tiên
      
      console.log('[HomePage] Suggested courses:', allSuggested.length);

      console.log('[HomePage] Load complete');
      setLoading(false);
    };
    load();
  }, [supabase, router]);

  const handleRegisterCourse = async (courseId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setRegistering(courseId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(ROUTES.LOGIN);
        return;
      }

      const { error } = await supabase
        .from('user_courses')
        .insert([{ user_id: user.id, course_id: courseId }]);

      if (error) {
        console.error('[HomePage] Error registering course:', error);
        alert('Đăng ký khóa học thất bại. Vui lòng thử lại.');
      } else {
        console.log('[HomePage] Course registered successfully:', courseId);
        // Cập nhật enrolledIds
        setEnrolledIds(prev => new Set(prev).add(courseId));
        // Reload suggested courses - remove the registered course
        setSuggested(prev => prev.filter(c => c.id !== courseId));
        setTotalSuggested(prev => prev - 1);
        // Reload enrolled courses to show the new one
        const { data: allActive } = await supabase
          .from('courses')
          .select('id,title,description,cover_url,level,created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        const { data: { user: reloadUser } } = await supabase.auth.getUser();
        if (reloadUser) {
          const { data: myIds } = await supabase
            .from('user_courses')
            .select('course_id')
            .eq('user_id', reloadUser.id);
          const enrolledIdsSet = new Set((myIds ?? []).map((r: any) => r.course_id));
          const { data: myCourses } = await supabase
            .from('courses')
            .select('id,title,description,cover_url,level,created_at')
            .in('id', Array.from(enrolledIdsSet))
            .order('created_at', { ascending: false });
          setEnrolled(myCourses?.slice(0, 4) ?? []);
          setTotalEnrolled(myCourses?.length ?? 0);
        }
      }
    } catch (error) {
      console.error('[HomePage] Error:', error);
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

  return (
    <div className="p-4 md:p-6">
      {/* Title với thanh màu cam bên trái */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-8 bg-orange-500 rounded"></div>
        <h1 className="text-2xl font-semibold text-gray-800">Khóa học tự ôn</h1>
      </div>

      {/* Course Grid - Khóa học tự ôn */}
      {enrolled.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Bạn chưa đăng ký khóa học nào.</p>
          <Link href="/courses" className="text-teal-600 hover:underline">
            Xem các khóa học khả dụng →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
          {enrolled.map((course) => (
            <Link
              key={course.id}
              href={ROUTES.COURSE_DETAIL(course.id)}
              className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 block"
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
              <div className="p-4">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-1 h-5 bg-orange-500 rounded mt-1 flex-shrink-0"></div>
                  <h3 className="font-semibold text-gray-800 line-clamp-2">{course.title}</h3>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Khóa học đang diễn ra</span>
                </div>

                <div className="w-full text-center py-2 px-4 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors text-sm font-medium">
                  Xem chi tiết
                </div>
              </div>
            </Link>
          ))}
          {/* Card Xem thêm - Khóa học tự ôn */}
          {totalEnrolled > enrolled.length && (
            <Link
              href={ROUTES.ALL_COURSES}
              className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 block border-dashed"
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
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-orange-500 rounded"></div>
            <h1 className="text-2xl font-semibold text-gray-800">Khóa học đề xuất</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {suggested.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
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
                <div className="p-4">
                  <Link href={ROUTES.COURSE_DETAIL(course.id)}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-1 h-5 bg-orange-500 rounded mt-1 flex-shrink-0"></div>
                      <h3 className="font-semibold text-gray-800 line-clamp-2 hover:text-orange-500 transition-colors">{course.title}</h3>
                    </div>
                  </Link>
                  
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{course.description}</p>

                  {/* Button Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleRegisterCourse(course.id, e)}
                      disabled={registering === course.id}
                      className="flex-1 text-center py-2 px-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-md transition-colors text-sm font-medium cursor-pointer"
                    >
                      {registering === course.id ? 'Đang đăng ký...' : 'Đăng ký'}
                    </button>
                    <Link href={ROUTES.COURSE_DETAIL(course.id)} className="flex-1">
                      <div className="w-full text-center py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors text-sm font-medium cursor-pointer">
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
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 block border-dashed"
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
                  <div className="w-full text-center py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium">
                    Xem tất cả
                  </div>
                </div>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

