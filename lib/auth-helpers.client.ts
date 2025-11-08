/**
 * Client-side Authentication and Authorization Helper Functions
 * Các helper function cho việc kiểm tra quyền truy cập ở client-side
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * User role types
 */
export type UserRole = 'admin' | 'user';

/**
 * Profile type với role information
 */
export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  role: UserRole;
  created_at: string;
}

/**
 * Lấy thông tin profile của user từ database
 * @param supabase - Supabase client instance
 * @param userId - User ID cần lấy thông tin
 * @returns UserProfile hoặc null nếu không tìm thấy
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, username, role, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[auth-helpers] Error fetching user profile:', error);
      return null;
    }

    // Cast role to string nếu nó là enum type
    // Fix cho trường hợp database dùng ENUM thay vì TEXT
    if (data && data.role) {
      data.role = String(data.role);
    }

    return data as UserProfile;
  } catch (error) {
    console.error('[auth-helpers] Exception fetching user profile:', error);
    return null;
  }
}

/**
 * Kiểm tra xem user có phải là admin không
 * @param supabase - Supabase client instance
 * @param userId - User ID cần kiểm tra
 * @returns true nếu user là admin, false nếu không
 */
export async function isUserAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const profile = await getUserProfile(supabase, userId);
  return profile?.role === 'admin';
}

/**
 * Kiểm tra user role và trả về role
 * @param supabase - Supabase client instance
 * @param userId - User ID cần kiểm tra
 * @returns UserRole hoặc null nếu không tìm thấy
 */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole | null> {
  const profile = await getUserProfile(supabase, userId);
  return profile?.role || null;
}

/**
 * Kiểm tra quyền truy cập admin page
 * Sử dụng trong client component để protect admin routes
 * @param supabase - Supabase client instance
 * @param router - Next.js router từ useRouter()
 * @param redirectTo - Route redirect nếu không có quyền (mặc định: /home)
 * @returns true nếu user là admin và có quyền truy cập
 */
export async function requireAdminAccess(
  supabase: SupabaseClient,
  router: { replace: (path: string) => void },
  redirectTo: string = '/home'
): Promise<boolean> {
  try {
    // Kiểm tra authentication
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.log('[auth-helpers] No authenticated user, redirecting to login');
      router.replace('/login');
      return false;
    }

    // Kiểm tra role
    const isAdmin = await isUserAdmin(supabase, user.id);
    
    if (!isAdmin) {
      console.log('[auth-helpers] User is not admin, access denied');
      router.replace(redirectTo);
      return false;
    }

    console.log('[auth-helpers] Admin access granted');
    return true;
  } catch (error) {
    console.error('[auth-helpers] Error checking admin access:', error);
    router.replace(redirectTo);
    return false;
  }
}
