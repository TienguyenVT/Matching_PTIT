'use client';

import { Suspense, lazy } from 'react';
import dynamic from 'next/dynamic';
import { useCourses, useUserCourses } from '@/hooks/use-courses';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

// Lazy load heavy components
const HeroSection = dynamic<{ userName: string }>(
  () => import('./components/HeroSection').then(mod => mod.default as any),
  {
    loading: () => <div className="h-96 bg-gray-100 animate-pulse" />,
  }
);

const RecommendedCoursesSection = dynamic<{ courses: any[]; userCourses: any[]; loading: boolean }>(
  () => import('./components/RecommendedCoursesSection').then(mod => mod.default as any),
  {
    loading: () => <CoursesSkeleton />,
    ssr: false, // Don't SSR for faster initial load
  }
);

const NewCoursesSection = dynamic<{ courses: any[]; loading: boolean }>(
  () => import('./components/NewCoursesSection').then(mod => mod.default as any),
  {
    loading: () => <CoursesSkeleton />,
    ssr: false,
  }
);

// Loading skeleton
function CoursesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-4 space-y-3">
            <div className="h-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OptimizedHomePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  
  // Use React Query hooks for data fetching
  const { data: recommendedCourses, isLoading: recommendedLoading } = useCourses({
    orderBy: 'created_at',
    limit: 6,
  });
  
  const { data: newCourses, isLoading: newCoursesLoading } = useCourses({
    orderBy: 'created_at',
    limit: 3,
  });
  
  const { data: userCourses } = useUserCourses();

  // Redirect if not authenticated
  if (!authLoading && !user) {
    router.replace(ROUTES.LOGIN);
    return null;
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section - Lazy loaded */}
      <Suspense fallback={<div className="h-96 bg-gray-100 animate-pulse" />}>
        <HeroSection userName={profile?.full_name || 'User'} />
      </Suspense>

      {/* Recommended Courses - Dynamic import with loading state */}
      <RecommendedCoursesSection 
        courses={recommendedCourses || []}
        userCourses={userCourses || []}
        loading={recommendedLoading}
      />

      {/* New Courses - Dynamic import */}
      <NewCoursesSection 
        courses={newCourses || []}
        loading={newCoursesLoading}
      />
    </div>
  );
}
