'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(ROUTES.LOGIN);
        return;
      }
      setUser(user);
      setLoading(false);
    };
    loadUser();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-6">Hồ sơ học tập</h1>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user?.user_metadata?.full_name || user?.email}</h2>
            <p className="text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input
              type="text"
              defaultValue={user?.user_metadata?.full_name || ''}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Nhập họ và tên"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              defaultValue={user?.email || ''}
              disabled
              className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            />
          </div>

          <div className="pt-4">
            <button className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700">
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

