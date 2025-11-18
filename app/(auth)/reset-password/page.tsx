'use client';

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export default function ResetPasswordPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { user } = useAuth(); // ✅ Move useAuth to component level
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if user has a valid session from the reset link
    if (!user) {
      setError('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
  }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!password || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Supabase update password error:', error);
        setError(error.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
      } else {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push(ROUTES.LOGIN);
        }, 2000);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-level1">
          <h1 className="text-xl font-semibold">Đặt lại mật khẩu thành công!</h1>
          <p className="mt-1 text-sm opacity-70">
            Mật khẩu của bạn đã được cập nhật. Đang chuyển đến trang đăng nhập...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-level1">
        <h1 className="text-xl font-semibold">Đặt lại mật khẩu</h1>
        <p className="mt-1 text-sm opacity-70">Nhập mật khẩu mới của bạn</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2"
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2"
            required
            minLength={6}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50">
            {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </button>
        </form>

        <p className="mt-4 text-sm">
          <Link href={ROUTES.LOGIN} className="text-primary underline">Quay lại đăng nhập</Link>
        </p>
      </div>
    </main>
  );
}

