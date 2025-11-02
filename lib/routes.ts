/**
 * Centralized Route Management
 * Quản lý tất cả routes, navigation helpers, và auth redirects logic
 */

// =====================================================
// ROUTE CONSTANTS
// =====================================================

export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  RESET_PASSWORD: '/reset-password',

  // Protected routes
  DASHBOARD: '/home',
  COURSES: '/courses',
  ALL_COURSES: '/all-courses',
  PROFILE: '/profile',

  // Dynamic routes - Course related
  COURSE_DETAIL: (courseId: string) => `/course/${courseId}/detail`,
  COURSE_LEARN: (courseId: string) => `/course/${courseId}/learn`,
  COURSE_MATCH: (courseId: string) => `/course/${courseId}/match`,
} as const;

// =====================================================
// ROUTE CATEGORIES
// =====================================================

export const PUBLIC_ROUTES = [ROUTES.HOME, ROUTES.LOGIN, ROUTES.REGISTER, ROUTES.RESET_PASSWORD] as const;

export const PROTECTED_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.COURSES,
  ROUTES.PROFILE,
] as const;

/**
 * Kiểm tra xem route có phải là public route không
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname as any);
}

/**
 * Kiểm tra xem route có phải là protected route không
 */
export function isProtectedRoute(pathname: string): boolean {
  // Static protected routes
  if (PROTECTED_ROUTES.includes(pathname as any)) {
    return true;
  }
  
  // Dynamic protected routes (course routes)
  if (pathname.startsWith('/course/') && (
    pathname.endsWith('/detail') ||
    pathname.endsWith('/learn') ||
    pathname.endsWith('/match')
  )) {
    return true;
  }
  
  return false;
}

// =====================================================
// NAVIGATION HELPERS - CLIENT SIDE
// =====================================================

/**
 * Get redirect URL sau khi login/register thành công
 * Mặc định redirect về /home
 */
export function getAuthRedirect(defaultPath: string = ROUTES.DASHBOARD): string {
  // Có thể mở rộng để lấy từ query params hoặc storage
  return defaultPath;
}

/**
 * Build full URL với origin (dùng cho OAuth redirects)
 */
export function getFullAuthRedirect(defaultPath: string = ROUTES.DASHBOARD): string {
  if (typeof window === 'undefined') {
    // Server-side: cần truyền origin từ params
    return defaultPath;
  }
  return `${window.location.origin}${defaultPath}`;
}

// =====================================================
// AUTH GUARDS - CLIENT SIDE
// =====================================================

/**
 * Client-side auth guard với redirect
 * Sử dụng trong useEffect của client components
 * 
 * @param user - User object từ supabase.auth.getUser()
 * @param router - Next.js router từ useRouter()
 * @param redirectTo - Route redirect nếu chưa auth (mặc định: /login)
 * @returns true nếu đã authenticated, false nếu đã redirect
 */
export async function requireAuthClient(
  user: any,
  router: { replace: (path: string) => void },
  redirectTo: string = ROUTES.LOGIN
): Promise<boolean> {
  if (!user) {
    console.log('[Routes] No user found, redirecting to:', redirectTo);
    router.replace(redirectTo);
    return false;
  }
  return true;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract courseId từ pathname
 * Ví dụ: /course/123/detail -> '123'
 */
export function extractCourseId(pathname: string): string | null {
  const match = pathname.match(/^\/course\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Validate courseId format (UUID)
 */
export function isValidCourseId(courseId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(courseId);
}
