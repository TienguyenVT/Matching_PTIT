import React from 'react';
import Link from 'next/link';

interface Course {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  level: string | null;
}

interface NewCoursesSectionProps {
  courses: Course[];
  loading: boolean;
}

export default function NewCoursesSection({ courses, loading }: NewCoursesSectionProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Khóa học mới nhất</h2>
        <Link href="/courses" className="text-primary hover:opacity-90 font-medium">
          Xem tất cả →
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.slice(0, 3).map(course => (
          <Link 
            key={course.id} 
            href={`/course/${course.id}/detail`}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
          >
            <div className="aspect-[16/10] bg-gray-100 relative overflow-hidden">
              {course.cover_url ? (
                <img 
                  src={course.cover_url} 
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
              <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                Mới
              </span>
            </div>
            
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                {course.title}
              </h3>
              <p className="text-gray-600 text-sm line-clamp-2">
                {course.description || 'Khóa học mới được cập nhật.'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
