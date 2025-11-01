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

type FilterType = 'all' | 'enrolled' | 'not-enrolled';

export default function AllCoursesPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      console.log('[AllCoursesPage] Starting load...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        console.log('[AllCoursesPage] No user found, redirecting to login');
        router.replace(ROUTES.LOGIN); 
        return; 
      }
      console.log('[AllCoursesPage] User authenticated:', user.id);

      // Lấy các khóa học đã đăng ký
      console.log('[AllCoursesPage] Fetching enrolled course IDs...');
      const { data: myIds, error: idsError } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', user.id);
      
      if (idsError) {
        console.error('[AllCoursesPage] Error fetching enrolled IDs:', idsError);
      }
      
      const enrolledSet = new Set((myIds ?? []).map((r: any) => r.course_id));
      console.log('[AllCoursesPage] Enrolled course IDs:', enrolledSet.size);
      setEnrolledIds(enrolledSet);

      // Lấy tất cả các khóa học active
      console.log('[AllCoursesPage] Fetching all active courses...');
      const { data: allActive, error: allActiveError } = await supabase
        .from('courses')
        .select('id,title,description,cover_url,level,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (allActiveError) {
        console.error('[AllCoursesPage] Error fetching all active courses:', allActiveError);
      } else {
        console.log('[AllCoursesPage] All active courses loaded:', allActive?.length || 0);
      }

      setAllCourses(allActive ?? []);
      console.log('[AllCoursesPage] Load complete');
      setLoading(false);
    };
    load();
  }, [supabase, router]);

  const getFilteredCourses = () => {
    if (filter === 'enrolled') {
      return allCourses.filter(c => enrolledIds.has(c.id));
    } else if (filter === 'not-enrolled') {
      return allCourses.filter(c => !enrolledIds.has(c.id));
    }
    return allCourses;
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
          <div className="w-1 h-8 bg-orange-500 rounded"></div>
          <h1 className="text-2xl font-semibold text-gray-800">Tất cả khóa học</h1>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Tất cả ({allCourses.length})
        </button>
        <button
          onClick={() => setFilter('enrolled')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'enrolled'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Đã đăng ký ({allCourses.filter(c => enrolledIds.has(c.id)).length})
        </button>
        <button
          onClick={() => setFilter('not-enrolled')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'not-enrolled'
              ? 'bg-orange-500 text-white'
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
                {/* Enrolled Badge */}
                {enrolledIds.has(course.id) && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    Đã đăng ký
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

                <div className={`w-full text-center py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                  enrolledIds.has(course.id)
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}>
                  {enrolledIds.has(course.id) ? 'Xem chi tiết' : 'Xem khóa học'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

