'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export default function SettingsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(ROUTES.LOGIN);
      }
    };
    checkAuth();
  }, [supabase, router]);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-6">Cài đặt</h1>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-medium mb-4">Tài khoản</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thông báo</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded" defaultChecked />
                <span className="text-sm text-gray-600">Nhận thông báo qua email</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option>Tiếng Việt</option>
                <option>English</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium mb-4">Bảo mật</h2>
          <div className="space-y-4">
            <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              Đổi mật khẩu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

