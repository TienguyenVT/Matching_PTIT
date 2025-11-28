import React from 'react';

interface HeroSectionProps {
  userName: string;
}

export default function HeroSection({ userName }: HeroSectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-12 px-6 md:px-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
          Chào mừng trở lại, {userName}! 👋
        </h1>
        <p className="text-base md:text-lg text-gray-600 max-w-2xl">
          Tiếp tục hành trình học tập của bạn và kết nối với cộng đồng PTIT trên một không gian gọn gàng, tập trung.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm md:text-base hover:opacity-90 shadow-sm transition-colors">
            Khám phá khóa học
          </button>
          <button className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-gray-300 text-gray-900 font-semibold text-sm md:text-base hover:bg-gray-50 transition-colors">
            Xem tiến độ học tập
          </button>
        </div>
      </div>
    </div>
  );
}
