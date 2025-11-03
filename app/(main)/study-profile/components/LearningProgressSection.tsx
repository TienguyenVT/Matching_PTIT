"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/routes";

type EnrolledCourse = {
  courseId: string;
  title: string;
  coverUrl: string | null;
  level: string | null;
  tags: string[] | null;
  enrolledAt: string | null;
  progressPercent: number;
};

export default function LearningProgressSection({ courses }: { courses: EnrolledCourse[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Tiến độ học tập</h2>
      {courses.length === 0 ? (
        <p className="text-gray-500">Bạn chưa đăng ký khóa học nào.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.courseId} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="h-32 bg-gray-100 overflow-hidden">
                {c.coverUrl ? (
                  <img src={c.coverUrl} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No cover</div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 line-clamp-2">{c.title}</h3>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  {c.level && <span className="px-2 py-0.5 bg-gray-100 rounded">{c.level}</span>}
                  {Array.isArray(c.tags) && c.tags.slice(0, 2).map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-gray-100 rounded">{t}</span>
                  ))}
                </div>
                <div>
                  <div className="w-full bg-gray-100 rounded h-2">
                    <div className="h-2 rounded bg-teal-500" style={{ width: `${Math.max(0, Math.min(100, c.progressPercent))}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-gray-600">{c.progressPercent}% hoàn thành</div>
                </div>
                <div className="pt-2">
                  <Link href={ROUTES.COURSE_DETAIL(c.courseId)} className="inline-flex items-center px-3 py-1.5 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm">
                    Tiếp tục học
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


