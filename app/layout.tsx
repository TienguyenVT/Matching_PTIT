import './globals.css';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata = {
  title: 'Matching PTIT',
  description: 'Nền tảng học ghép đôi học tập'
} satisfies import('next').Metadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`min-h-dvh antialiased ${montserrat.variable}`}>{children}</body>
    </html>
  );
}

