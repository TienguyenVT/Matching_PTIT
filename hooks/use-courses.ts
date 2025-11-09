'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';

// Query keys
export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (filters: any) => [...courseKeys.lists(), { filters }] as const,
  details: () => [...courseKeys.all, 'detail'] as const,
  detail: (id: string) => [...courseKeys.details(), id] as const,
  userCourses: (userId: string) => ['user-courses', userId] as const,
};

// Fetch all active courses
export function useCourses(options?: { 
  orderBy?: string;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: courseKeys.list(options),
    queryFn: async () => {
      const supabase = supabaseBrowser();
      let query = supabase
        .from('courses')
        .select('id, title, description, cover_url, level, tags, created_at')
        .eq('is_active', true);

      if (options?.orderBy) {
        query = query.order(options.orderBy);
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.search) {
        query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    // ✅ Stale-while-revalidate: Show cached data immediately, revalidate in background
    staleTime: 30 * 1000, // Fresh for 30 seconds
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: true, // Background revalidation on mount
  });
}

// Fetch single course details
export function useCourseDetail(courseId: string) {
  return useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id, title, description, cover_url, level, tags, 
          created_at, modules_count, students_count
        `)
        .eq('id', courseId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
    // Cache course details for 30 minutes
    staleTime: 30 * 60 * 1000,
  });
}

// Fetch user's enrolled courses
export function useUserCourses(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: courseKeys.userCourses(targetUserId!),
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from('user_courses')
        .select(`
          course_id,
          created_at,
          courses(id, title, cover_url, level, tags)
        `)
        .eq('user_id', targetUserId!);

      if (error) throw error;

      // Transform data
      return data?.map((uc: any) => ({
        courseId: uc.course_id,
        enrolledAt: uc.created_at,
        ...uc.courses,
      }));
    },
    enabled: !!targetUserId,
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
}

// Enroll in a course
export function useEnrollCourse() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (courseId: string) => {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from('user_courses')
        .insert({ user_id: user!.id, course_id: courseId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate user courses cache
      queryClient.invalidateQueries({ queryKey: courseKeys.userCourses(user!.id) });
    },
  });
}

// Batch fetch multiple queries in parallel
export async function prefetchDashboardData(queryClient: any, userId: string) {
  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: courseKeys.list({ limit: 6 }),
      queryFn: async () => {
        const supabase = supabaseBrowser();
        const { data } = await supabase
          .from('courses')
          .select('id, title, description, cover_url, level')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(6);
        return data;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: courseKeys.userCourses(userId),
      queryFn: async () => {
        const supabase = supabaseBrowser();
        const { data } = await supabase
          .from('user_courses')
          .select('course_id')
          .eq('user_id', userId);
        return data;
      },
    }),
  ]);
}
