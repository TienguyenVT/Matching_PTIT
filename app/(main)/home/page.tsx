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
  const [loading, setLoading] = useState(true);

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
      
      const enrolledIds = new Set((myIds ?? []).map((r: any) => r.course_id));
      console.log('[HomePage] Enrolled course IDs:', enrolledIds.size);

      if (enrolledIds.size > 0) {
        const { data: myCourses, error: coursesError } = await supabase
          .from('courses')
          .select('id,title,description,cover_url,level,created_at')
          .in('id', Array.from(enrolledIds))
          .order('created_at', { ascending: false });
        
        if (coursesError) {
          console.error('[HomePage] Error fetching enrolled courses:', coursesError);
        } else {
          console.log('[HomePage] Enrolled courses loaded:', myCourses?.length || 0);
        }
        
        setEnrolled(myCourses ?? []);
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

      const suggestedCourses = (allActive ?? []).filter(
        (c: any) => !enrolledIds.has(c.id)
      ).slice(0, 4); // Giới hạn 4 khóa học đề xuất
      
      console.log('[HomePage] Suggested courses:', suggestedCourses.length);
      setSuggested(suggestedCourses);

      console.log('[HomePage] Load complete');
      setLoading(false);
    };
    load();
  }, [supabase, router]);

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
                  
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{course.description}</p>

                  <div className="w-full text-center py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors text-sm font-medium">
                    Xem khóa học
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

