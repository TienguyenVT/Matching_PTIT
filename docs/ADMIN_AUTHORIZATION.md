# Hướng dẫn Phân quyền Admin/User

## Tổng quan

Hệ thống đã được triển khai phân quyền giữa **Admin** và **User** dựa trên cột `role` trong bảng `profiles` của database.

## Các Role

- **admin**: Có quyền truy cập trang `/admin` và các API admin
- **user**: Không được phép truy cập trang `/admin` và các API admin

## Cơ chế hoạt động

### 1. Database Structure

Bảng `profiles` có cột `role` với giá trị:
- `'admin'` - Quyền quản trị
- `'user'` - Quyền người dùng thông thường

```sql
-- Ví dụ dữ liệu trong bảng profiles
id                                   | email                      | role
-------------------------------------|----------------------------|-------
03a3f0eb-5e27-47f9-9363-5c90aa070aa8 | admin@matchingptit.local   | admin
39a9ab3e-5ab2-4155-af87-871b7d75ea75 | tiencuber4@gmail.com       | user
```

### 2. Client-side Protection (Trang /admin)

File: `app/(main)/admin/page.tsx`

Khi user truy cập trang `/admin`:
1. Hệ thống kiểm tra authentication
2. Lấy thông tin profile từ database
3. Kiểm tra cột `role`
4. Nếu không phải admin → redirect về `/home`
5. Hiển thị thông báo "Đang kiểm tra quyền truy cập..."

### 3. API Protection

Tất cả các API endpoint trong `/api/admin/*` đều được bảo vệ:

- `/api/admin/process-json` - Upload và xử lý JSON
- `/api/admin/process-pdf` - Upload và xử lý PDF  
- `/api/admin/batch-process-pdfs` - Xử lý batch PDFs
- `/api/admin/batch-progress/[progressId]` - Lấy tiến trình batch

Khi gọi API:
1. Kiểm tra authentication (Bearer token hoặc cookie)
2. Lấy thông tin profile từ database
3. Kiểm tra cột `role`
4. Nếu không phải admin → trả về `403 Forbidden`

## Sử dụng Helper Functions

### Client-side (React Component)

**Import từ `@/lib/auth-helpers.client`** (cho client components):

```typescript
import { requireAdminAccess } from '@/lib/auth-helpers.client';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

function MyAdminComponent() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  useEffect(() => {
    const checkAuth = async () => {
      const hasAccess = await requireAdminAccess(supabase, router);
      if (!hasAccess) {
        // Đã tự động redirect
        return;
      }
      // Tiếp tục load component
    };
    checkAuth();
  }, []);
}
```

### API Route (Server-side)

**Import từ `@/lib/auth-helpers.server`** (cho API routes):

```typescript
import { NextRequest } from 'next/server';
import { requireAdminAPI } from '@/lib/auth-helpers.server';

export async function POST(req: NextRequest) {
  // Kiểm tra quyền admin
  const { user, response } = await requireAdminAPI(req);
  if (response) {
    return response; // Trả về 401 hoặc 403 error
  }
  
  // User có quyền admin, tiếp tục xử lý
  // ...
}
```

## Quản lý User Roles

### Kiểm tra role của user

```typescript
import { getUserProfile, isUserAdmin } from '@/lib/auth-helpers.client';
import { supabaseBrowser } from '@/lib/supabase/client';

const supabase = supabaseBrowser();
const userId = 'user-id-here';

// Lấy profile đầy đủ
const profile = await getUserProfile(supabase, userId);
console.log(profile?.role); // 'admin' hoặc 'user'

// Kiểm tra nhanh
const isAdmin = await isUserAdmin(supabase, userId);
console.log(isAdmin); // true hoặc false
```

### Thay đổi role (qua database)

Sử dụng Supabase Dashboard hoặc SQL:

```sql
-- Thăng cấp user lên admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'user@example.com';

-- Hạ quyền admin xuống user
UPDATE profiles 
SET role = 'user' 
WHERE email = 'admin@example.com';
```

## Testing

### Test với tài khoản Admin

1. Đăng nhập với email: `admin@matchingptit.local`
2. Truy cập: `http://localhost:3000/admin`
3. Kết quả: Vào được trang admin thành công

### Test với tài khoản User

1. Đăng nhập với email: `tiencuber4@gmail.com`
2. Truy cập: `http://localhost:3000/admin`
3. Kết quả: Bị redirect về `/home`

### Test API với Postman

```bash
# Login và lấy access token
# Gọi admin API với token

curl -X POST http://localhost:3000/api/admin/process-json \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@course.json"

# Nếu là user: 403 Forbidden
# Nếu là admin: 200 OK + kết quả
```

## Error Messages

| Status | Message | Ý nghĩa |
|--------|---------|---------|
| 401 Unauthorized | "Unauthorized. Vui lòng đăng nhập." | Chưa đăng nhập |
| 403 Forbidden | "Forbidden. Bạn không có quyền truy cập chức năng này." | Đã đăng nhập nhưng không phải admin |

## Files được thay đổi

### Thêm mới
- `lib/auth-helpers.client.ts` - Client-side helper functions (cho React components)
- `lib/auth-helpers.server.ts` - Server-side helper functions (cho API routes)
- `docs/ADMIN_AUTHORIZATION.md` - Documentation đầy đủ

### Cập nhật
- `app/(main)/admin/page.tsx` - Thêm check admin role
- `app/api/admin/process-json/route.ts` - Thêm admin authorization
- `app/api/admin/process-pdf/route.ts` - Thêm admin authorization
- `app/api/admin/batch-process-pdfs/route.ts` - Thêm admin authorization
- `app/api/admin/batch-progress/[progressId]/route.ts` - Thêm admin authorization

## Lưu ý quan trọng

1. **Role được lưu trong database**: Không store role trong localStorage hay session
2. **Kiểm tra cả client và server**: Không chỉ dựa vào client-side check
3. **API luôn được bảo vệ**: Dù client bypass được UI, API vẫn chặn
4. **Mặc định là user**: User mới tạo sẽ có role = 'user'
5. **Cần tài khoản admin ban đầu**: Tạo tài khoản admin đầu tiên qua SQL
6. **Tách client/server helpers**: 
   - Sử dụng `@/lib/auth-helpers.client` cho client components
   - Sử dụng `@/lib/auth-helpers.server` cho API routes
   - Điều này tránh lỗi import `next/headers` trong client components

## Troubleshooting

### Vấn đề: User admin vẫn bị redirect

**Nguyên nhân**: Cột `role` trong database không phải `'admin'`

**Giải pháp**:
```sql
-- Kiểm tra role
SELECT id, email, role FROM profiles WHERE email = 'your-email@example.com';

-- Update role
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Vấn đề: API trả về 401 dù đã đăng nhập

**Nguyên nhân**: Token không được gửi hoặc đã hết hạn

**Giải pháp**:
1. Kiểm tra cookie authentication
2. Refresh session: `supabase.auth.refreshSession()`
3. Đăng nhập lại

### Vấn đề: Không thể thay đổi role trong database

**Nguyên nhân**: RLS (Row Level Security) có thể chặn

**Giải pháp**:
- Sử dụng Supabase Dashboard để update
- Hoặc dùng service role key qua API
