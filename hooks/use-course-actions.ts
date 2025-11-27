'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import { courseKeys } from './use-courses';

/**
 * ✅ Optimistic UI: Enroll course with instant feedback
 * Updates UI immediately before API completes
 */
export function useEnrollCourseOptimistic() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (courseId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from('user_courses')
        .insert({ user_id: user.id, course_id: courseId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    // ✅ Optimistic Update: Update UI immediately
    onMutate: async (courseId) => {
      if (!user?.id) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: courseKeys.userCourses(user.id) });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(courseKeys.userCourses(user.id));

      // Optimistically update UI
      queryClient.setQueryData(courseKeys.userCourses(user.id), (old: any) => {
        if (!old) return [{ courseId, enrolledAt: new Date().toISOString() }];
        return [...old, { courseId, enrolledAt: new Date().toISOString() }];
      });

      return { previousData };
    },
    // ✅ Rollback on error
    onError: (err, courseId, context: any) => {
      if (context?.previousData && user?.id) {
        queryClient.setQueryData(courseKeys.userCourses(user.id), context.previousData);
      }
      console.error('[useEnrollCourseOptimistic] Error:', err);
    },
    // ✅ Refetch to ensure data consistency
    onSettled: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: courseKeys.userCourses(user.id) });
      }
    },
  });
}

/**
 * ✅ Optimistic UI: Unenroll course
 */
export function useUnenrollCourseOptimistic() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (courseId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from('user_courses')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (error) throw error;
    },
    onMutate: async (courseId) => {
      if (!user?.id) return;

      await queryClient.cancelQueries({ queryKey: courseKeys.userCourses(user.id) });
      const previousData = queryClient.getQueryData(courseKeys.userCourses(user.id));

      // Remove course immediately from UI
      queryClient.setQueryData(courseKeys.userCourses(user.id), (old: any) => {
        if (!old) return [];
        return old.filter((uc: any) => uc.courseId !== courseId);
      });

      return { previousData };
    },
    onError: (err, courseId, context: any) => {
      if (context?.previousData && user?.id) {
        queryClient.setQueryData(courseKeys.userCourses(user.id), context.previousData);
      }
      console.error('[useUnenrollCourseOptimistic] Error:', err);
    },
    onSettled: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: courseKeys.userCourses(user.id) });
      }
    },
  });
}

/**
 * ✅ Optimistic UI: Like/Unlike course (if you add this feature)
 */
export function useLikeCourseOptimistic() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ courseId, isLiked }: { courseId: string; isLiked: boolean }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const supabase = supabaseBrowser();
      
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('course_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('course_id', courseId);
        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('course_likes')
          .insert({ user_id: user.id, course_id: courseId });
        if (error) throw error;
      }
    },
    // ✅ Instant visual feedback
    onMutate: async ({ courseId, isLiked }) => {
      // Update UI immediately - toggle like state
      // User sees instant feedback while API processes
      
      await queryClient.cancelQueries({ queryKey: ['course-likes', courseId] });
      const previousData = queryClient.getQueryData(['course-likes', courseId]);

      queryClient.setQueryData(['course-likes', courseId], !isLiked);

      return { previousData, courseId };
    },
    onError: (err, variables, context: any) => {
      // Rollback if API fails
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(['course-likes', context.courseId], context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      // Sync with server
      queryClient.invalidateQueries({ queryKey: ['course-likes', variables.courseId] });
    },
  });
}
