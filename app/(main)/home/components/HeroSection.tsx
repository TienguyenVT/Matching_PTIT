import React from 'react';

interface HeroSectionProps {
  userName: string;
}

export default function HeroSection({ userName }: HeroSectionProps) {
  return (
    <div className="bg-gradient-to-r from-teal-500 to-blue-600 text-white py-16 px-6 rounded-lg shadow-lg">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Chào mừng trở lại, {userName}! 👋
        </h1>
        <p className="text-lg md:text-xl opacity-95">
          Tiếp tục hành trình học tập của bạn và kết nối với cộng đồng PTIT.
        </p>
        <div className="mt-8 flex gap-4">
          <button className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
            Khám phá khóa học
          </button>
          <button className="bg-transparent border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-teal-600 transition">
            Xem tiến độ học tập
          </button>
        </div>
      </div>
    </div>
  );
}
