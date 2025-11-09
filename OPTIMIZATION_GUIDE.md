# 🚀 Hướng dẫn Tối ưu Hiệu năng Next.js + Supabase

## 📊 Vấn đề hiện tại
- **6 lần** gọi `auth.getUser()` trong 1 request
- **5 lần** duplicate calls tới `profiles` API  
- Bundle size **1.3MB** blocking render
- Thời gian tải: **35 giây - 4.3 phút**

## ✅ Giải pháp đã triển khai

### 1. Global Auth State với Context
- **File:** `providers/auth-provider.tsx`
- **Lợi ích:** 
  - Chỉ gọi `auth.getUser()` **1 lần duy nhất**
  - Cache user profile trong localStorage (5 phút)
  - Tự động refresh khi cần

### 2. React Query cho Data Caching
- **Files:** `providers/query-provider.tsx`, `hooks/use-courses.ts`
- **Lợi ích:**
  - Cache API responses tự động
  - Deduplication - không gọi API trùng lặp
  - Background refetch thông minh

### 3. Code Splitting & Lazy Loading
- **Files:** `app/(main)/home/page-optimized.tsx`
- **Lợi ích:**
  - Giảm initial bundle size **60-70%**
  - Lazy load components không cần thiết
  - Faster Time to Interactive (TTI)

### 4. Optimized Components
- **Files:** `Header-optimized.tsx`
- **Lợi ích:**
  - Sử dụng global auth state
  - Memoization cho expensive computations
  - Event listeners cleanup

## 🛠️ Cách triển khai

### Bước 1: Cài đặt dependencies
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### Bước 2: Update Root Layout
Rename và update file `app/layout.tsx`:
```tsx
// Rename layout-optimized.tsx → layout.tsx
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

### Bước 3: Update Components
Replace các components cũ với optimized versions:
- `Header.tsx` → `Header-optimized.tsx`
- `Sidebar.tsx` → Update để dùng `useAuth()` hook

### Bước 4: Update Pages
Thay thế code trong các pages:
```tsx
// Ví dụ: app/(main)/home/page.tsx
import { useAuth } from '@/providers/auth-provider';
import { useCourses } from '@/hooks/use-courses';

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const { data: courses } = useCourses();
  
  // Không cần gọi auth.getUser() nữa!
  // Không cần fetch profiles nữa!
}
```

### Bước 5: Update Next.js Config
```bash
# Backup config cũ
cp next.config.js next.config.backup.js

# Apply optimized config
cp next.config.optimized.js next.config.js
```

## 📈 Kết quả mong đợi

### Trước tối ưu:
- Auth calls: **6 requests**
- Profile calls: **5 requests**  
- Initial JS: **1.3MB**
- Load time: **35+ giây**

### Sau tối ưu:
- Auth calls: **1 request** ✅
- Profile calls: **1 request** ✅
- Initial JS: **~400KB** ✅
- Load time: **< 3 giây** ✅

## 🔥 Performance Tips

### 1. Sử dụng React Query cho mọi API call
```tsx
// BAD - Gọi API trực tiếp
useEffect(() => {
  supabase.from('profiles').select()...
}, [])

// GOOD - Dùng React Query
const { data } = useQuery({
  queryKey: ['profiles', userId],
  queryFn: fetchProfile
})
```

### 2. Lazy load heavy components
```tsx
// BAD
import HeavyComponent from './HeavyComponent'

// GOOD
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false
})
```

### 3. Prefetch critical data
```tsx
// Trong server components
await queryClient.prefetchQuery({
  queryKey: ['courses'],
  queryFn: fetchCourses
})
```

### 4. Use Suspense boundaries
```tsx
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

## 🔍 Monitoring

### Browser DevTools
1. Network tab: Check for duplicate requests
2. Performance tab: Measure load times
3. React DevTools: Check re-renders

### React Query DevTools
```tsx
// Chỉ hiện trong development
if (process.env.NODE_ENV === 'development') {
  <ReactQueryDevtools />
}
```

## ⚠️ Lưu ý

1. **Clear cache khi deploy:**
```bash
# Clear Next.js cache
rm -rf .next
# Clear node_modules
rm -rf node_modules
npm install
```

2. **Environment variables:**
Đảm bảo các biến môi trường đúng trong `.env.local`

3. **Database indexes:**
Tạo indexes cho các queries thường xuyên:
```sql
CREATE INDEX idx_profiles_user_id ON profiles(id);
CREATE INDEX idx_user_courses_user ON user_courses(user_id);
```

## 📞 Support

Nếu gặp vấn đề:
1. Check console logs
2. Check Network tab
3. Clear localStorage: `localStorage.clear()`
4. Restart dev server

## ✨ Next Steps

1. Implement Service Worker cho offline support
2. Add image optimization với Next/Image
3. Implement virtual scrolling cho lists lớn
4. Add Redis caching layer cho Supabase
