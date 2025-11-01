import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

export default function HomePage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-semibold">Matching PTIT</h1>
        <p className="text-neutral-500">Nền tảng học ghép đôi học tập</p>
        <div className="flex gap-4 justify-center mt-6">
          <Link href={ROUTES.LOGIN} className="rounded-md bg-primary px-6 py-2 text-white hover:opacity-90">
            Đăng nhập
          </Link>
          <Link href={ROUTES.REGISTER} className="rounded-md border border-primary px-6 py-2 text-primary hover:bg-primary hover:text-white">
            Đăng ký
          </Link>
        </div>
      </div>
    </main>
  );
}


