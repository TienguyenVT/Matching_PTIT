/**
 * Server-side Authentication and Authorization Helper Functions
 * Các helper function cho việc kiểm tra quyền truy cập ở server-side (API routes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from './supabase/server';
import { getUserProfile, isUserAdmin, UserRole, UserProfile } from './auth-helpers.client';

// Re-export types và client helpers để dễ sử dụng
export type { UserRole, UserProfile };
export { getUserProfile, isUserAdmin };

/**
 * Lấy authenticated user từ API request
 * Hỗ trợ cả Bearer token và cookie-based auth
 * @param req - NextRequest object
 * @returns User object hoặc null
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let user = null;
  
  // Ưu tiên: Nếu có Bearer token, verify token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    
    if (url && anon) {
      const tempClient = createClient(url, anon);
      const { data: { user: tokenUser }, error } = await tempClient.auth.getUser(token);
      if (!error && tokenUser) {
        user = tokenUser;
      }
    }
  }
  
  // Fallback: Lấy user từ cookie
  if (!user) {
    const supabase = supabaseServer();
    const { data: { user: cookieUser }, error } = await supabase.auth.getUser();
    if (!error && cookieUser) {
      user = cookieUser;
    }
  }
  
  return user;
}

/**
 * Kiểm tra quyền admin trong API route
 * Trả về response nếu không có quyền, hoặc null nếu có quyền
 * @param req - NextRequest object
 * @returns NextResponse nếu không có quyền, null nếu có quyền admin
 */
export async function requireAdminAPI(
  req: NextRequest
): Promise<{ user: any; response: null } | { user: null; response: NextResponse }> {
  // Lấy authenticated user
  const user = await getAuthenticatedUser(req);
  
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Unauthorized. Vui lòng đăng nhập.' },
        { status: 401 }
      )
    };
  }
  
  // Kiểm tra admin role
  const supabase = supabaseServer();
  const isAdmin = await isUserAdmin(supabase, user.id);
  
  if (!isAdmin) {
    console.log(`[auth-helpers] User ${user.id} attempted to access admin API without permission`);
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Forbidden. Bạn không có quyền truy cập chức năng này.' },
        { status: 403 }
      )
    };
  }
  
  console.log(`[auth-helpers] Admin API access granted for user ${user.id}`);
  return { user, response: null };
}
