'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { ROUTES, getFullAuthRedirect } from '@/lib/routes';

export default function RegisterPage() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: getFullAuthRedirect(ROUTES.DASHBOARD),
      },
    });
    setLoading(false);
    if (error) {
      console.error('Supabase signup error:', error);
      setError(error.message || 'Lỗi đăng ký. Vui lòng kiểm tra lại thông tin.');
    } else {
      setMsg('Đăng ký thành công. Vui lòng kiểm tra email để xác nhận.');
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-level1">
        <h1 className="text-xl font-semibold">Đăng ký</h1>
        <p className="mt-1 text-sm opacity-70">Tạo tài khoản mới</p>

        <form onSubmit={onRegister} className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Họ và tên"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2"
            required
          />
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
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50">
            {loading ? 'Đang xử lý...' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="mt-4 text-sm">
          Đã có tài khoản? <Link href="/login" className="text-primary underline">Đăng nhập</Link>
        </p>
      </div>
    </main>
  );
}
