'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { ROUTES, getFullAuthRedirect } from '@/lib/routes';

export default function LoginPage() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = async () => {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getFullAuthRedirect(ROUTES.DASHBOARD) },
    });
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      console.error('Supabase login error:', error);
      setError(error.message || 'Lỗi đăng nhập. Vui lòng kiểm tra lại email và mật khẩu.');
    } else {
      window.location.href = ROUTES.DASHBOARD;
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-level1">
        <h1 className="text-xl font-semibold">Đăng nhập</h1>
        <div className="my-4 h-px bg-gray-200" />

        <form onSubmit={onEmail} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50">
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-4 text-sm">
          Chưa có tài khoản? <Link href="/register" className="text-primary underline">Đăng ký</Link>
        </p>
      </div>
    </main>
  );
}
