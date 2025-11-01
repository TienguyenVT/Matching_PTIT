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
};

export default function CoursesPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [available, setAvailable] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(ROUTES.LOGIN); return; }

      try {
        const { data: myIds, error: enrolledError } = await supabase
          .from('user_courses')
          .select('course_id')
          .eq('user_id', user.id);
        
        if (enrolledError) {
          console.error('Error loading enrolled courses:', enrolledError);
        }
        
        const enrolledIds = new Set((myIds ?? []).map((r: any) => r.course_id));
        console.log('Enrolled course IDs:', Array.from(enrolledIds));

        const { data: allActive, error: coursesError } = await supabase
          .from('courses')
          .select('id,title,description,cover_url,level')
          .eq('is_active', true)
          .order('title');

        if (coursesError) {
          console.error('Error loading courses:', coursesError);
          alert('Lỗi khi tải danh sách khóa học: ' + coursesError.message);
        } else {
          console.log('Total active courses:', allActive?.length || 0);
          console.log('Course IDs:', allActive?.map(c => c.id) || []);
        }

        const filtered = (allActive ?? []).filter((c: any) => !enrolledIds.has(c.id));
        console.log('Available courses after filter:', filtered.length);
        setAvailable(filtered);
      } catch (error) {
        console.error('Load error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, router]);

  const onRegister = async (courseId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace(ROUTES.LOGIN); return; }

    if (!courseId) {
      alert('Lỗi: Không tìm thấy ID khóa học');
      return;
    }

    try {
      const requestBody = { courseId };
      console.log('Registering course:', requestBody);
      
      const res = await fetch('/api/register-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });
      
      const data = await res.json();
      console.log('Register response:', data);
      
      if (res.ok) {
        router.replace('/home');
      } else {
        const errorMsg = data.details 
          ? `${data.error}: ${JSON.stringify(data.details)}` 
          : data.error || 'Đăng ký thất bại';
        alert(errorMsg);
      }
    } catch (error) {
      console.error('Register error:', error);
      alert('Có lỗi xảy ra khi đăng ký khóa học');
    }
  };

  if (loading) return <main className="p-4 md:p-6">Đang tải...</main>;

  return (
    <main className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-8 bg-orange-500 rounded"></div>
        <h1 className="text-2xl font-semibold text-gray-800">Khóa học khả dụng</h1>
      </div>

      {available.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">Hiện không còn khóa học khả dụng.</p>
          <p className="text-sm text-gray-400">
            Vui lòng chạy script SQL trong <code className="bg-gray-100 px-2 py-1 rounded text-xs">supabase/seed_sample_data.sql</code> để tạo dữ liệu mẫu.
          </p>
          <details className="mt-4 text-left max-w-2xl mx-auto">
            <summary className="cursor-pointer text-sm text-teal-600 hover:text-teal-700">Hướng dẫn tạo dữ liệu mẫu</summary>
            <div className="mt-2 p-4 bg-gray-50 rounded text-xs">
              <p className="mb-2">1. Mở Supabase Dashboard → SQL Editor</p>
              <p className="mb-2">2. Copy nội dung file <code className="bg-white px-1">supabase/seed_sample_data.sql</code></p>
              <p className="mb-2">3. Paste vào SQL Editor và chạy</p>
              <p>4. Refresh trang này để xem khóa học</p>
            </div>
          </details>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {available.map((c) => (
            <div key={c.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
              <div
                className="h-40 w-full bg-gray-200"
                style={{ backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 line-clamp-2">{c.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                <div className="mt-3 flex gap-2">
                  <Link href={ROUTES.COURSE_DETAIL(c.id)} className="flex-1 text-center rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 text-sm font-medium">
                    Xem chi tiết
                  </Link>
                  <button onClick={() => onRegister(c.id)} className="flex-1 rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 text-sm font-medium">Đăng ký</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}


