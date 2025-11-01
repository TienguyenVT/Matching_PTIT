import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { ROUTES } from './routes';

export async function getUser() {
  const supabase = supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('[Auth] getUser error:', error.message);
    return { user: null };
  }
  console.log('[Auth] getUser success, user:', user?.id || 'null');
  return { user };
}

export async function requireAuth(redirectTo: string = ROUTES.LOGIN) {
  console.log('[Auth] requireAuth called');
  const { user } = await getUser();
  if (!user) {
    console.log('[Auth] No user found, redirecting to:', redirectTo);
    redirect(redirectTo);
  }
  console.log('[Auth] requireAuth success, user:', user.id);
  return user;
}

export async function requireAuthServer() {
  const { user } = await getUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

/**
 * Check auth status (không redirect, chỉ return user)
 * Dùng khi cần check nhưng không muốn redirect tự động
 */
export async function checkAuthServer() {
  const { user } = await getUser();
  return { user, isAuthenticated: !!user };
}
