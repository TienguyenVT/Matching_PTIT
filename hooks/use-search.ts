'use client';

import { useQuery } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useDebounce } from './use-debounce';

interface SearchCoursesParams {
  query: string;
  enabled?: boolean;
}

/**
 * Search courses with debounce
 * Only triggers API call 300ms after user stops typing
 */
export function useSearchCourses({ query, enabled = true }: SearchCoursesParams) {
  // Debounce search query - waits 300ms after user stops typing
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ['search-courses', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return [];
      }

      const supabase = supabaseBrowser();
      
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, description, cover_url, level, is_active')
        .eq('is_active', true)
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[useSearchCourses] Error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime: 1 * 60 * 1000, // Cache for 1 minute
  });
}

/**
 * Search users with debounce
 */
export function useSearchUsers({ query, enabled = true }: SearchCoursesParams) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ['search-users', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return [];
      }

      const supabase = supabaseBrowser();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, role')
        .or(`username.ilike.%${debouncedQuery}%,full_name.ilike.%${debouncedQuery}%`)
        .limit(20);

      if (error) {
        console.error('[useSearchUsers] Error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime: 1 * 60 * 1000,
  });
}
