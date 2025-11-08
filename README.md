# Matching PTIT — Hệ thống Tạo Khóa Học từ Tài liệu

Hệ thống web giúp quản trị viên (admin) upload tài liệu (PDF/JSON có cấu trúc) để tự động phân tích và tạo khóa học. Người dùng (user) có thể xem, gợi ý khóa học và học tập.

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Kiến trúc phần mềm](#kiến-trúc-phần-mềm)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Thiết lập Supabase](#thiết-lập-supabase)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Chạy dự án](#chạy-dự-án)
- [Phân quyền Admin/User](#phân-quyền-adminuser)
- [API Admin](#api-admin)
- [Troubleshooting](#troubleshooting)
- [Scripts](#scripts)
- [Thư mục & cấu trúc](#thư-mục--cấu-trúc)

---

## Tính năng

- Phân tách quyền Admin/User dựa trên cột `role` trong bảng `profiles` (Supabase)
- Admin có trang quản trị `/admin` để:
  - Upload PDF/JSON có cấu trúc
  - Batch-process nhiều tài liệu
  - Theo dõi tiến độ xử lý (batch progress)
- Người dùng thường xem danh sách khóa học, gợi ý khóa học
- Đăng nhập/xác thực bằng Supabase Auth
- Lưu trữ dữ liệu trên Postgres (Supabase)

## Công nghệ

- Next.js 14 (App Router)
- React 18 + TypeScript
- Supabase: Auth, Postgres, RLS, PostgREST
- Phân tích PDF/JSON: các service nội bộ (`lib/services`)

## Kiến trúc phần mềm

- `app/` — App Router (pages, API routes)
  - `app/(main)/admin/page.tsx` — Trang quản trị (client component, chỉ admin mới truy cập)
  - `app/api/admin/*` — API dành cho admin (được bảo vệ)
- `lib/supabase/`
  - `client.ts` — Supabase client chạy trên trình duyệt
  - `server.ts` — Supabase client cho server (sử dụng `next/headers`)
- `lib/auth-helpers.client.ts` — Helper client kiểm tra quyền (không import server-only)
- `lib/auth-helpers.server.ts` — Helper server bảo vệ API (kiểm tra quyền admin)
- `lib/services/` — Dịch vụ phân tích PDF/JSON, batch-progress, v.v.

---

## Bắt đầu nhanh

### 1) Clone repository

```bash
git clone https://github.com/TienguyenVT/Matching_PTIT.git
cd Matching_PTIT
```

### 2) Cài đặt dependencies

Sử dụng npm (hoặc pnpm/yarn):

```bash
npm install
```

### 3) Tạo project Supabase

- Vào https://supabase.com/ → tạo Project mới
- Lấy các keys/URL trong Project Settings → API:
  - `Project URL` → dùng cho `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → dùng cho `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` key → dùng cho `SUPABASE_SERVICE_ROLE_KEY` (server-side)

---

## Thiết lập Supabase

### 1) Tạo bảng profiles và enum (nếu chưa có)

Bạn có thể đang dùng enum `user_role`. Nếu chưa có, tham khảo mẫu dưới (điều chỉnh theo schema hiện tại của bạn nếu đã tồn tại):

```sql
-- Enum role
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Bảng profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### 2) Thiết lập RLS Policies (khuyến nghị — tránh đệ quy)

Để tránh lỗi RLS recursion, sử dụng bộ policy tối giản này (Option 3):

```sql
-- Xóa tất cả policy cũ (nếu có)
DROP POLICY IF EXISTS "profiles authenticated users can read" ON profiles;
DROP POLICY IF EXISTS "profiles public read" ON profiles;
DROP POLICY IF EXISTS "profiles self select" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON profiles;
DROP POLICY IF EXISTS "profiles self update" ON profiles;
DROP POLICY IF EXISTS "profiles self insert" ON profiles;

-- Cho phép tất cả authenticated users đọc profiles
CREATE POLICY "Anyone authenticated can read profiles"
ON profiles FOR SELECT TO authenticated USING (true);

-- User chỉ được insert/update/delete profile của chính họ
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
ON profiles FOR DELETE TO authenticated
USING (auth.uid() = id);
```

### 3) Tạo tài khoản admin đầu tiên

Đăng ký tài khoản qua ứng dụng hoặc Admin UI của Supabase, sau đó gán role admin:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@matchingptit.local';
```

> Lưu ý: Thay email bằng tài khoản admin của bạn.

---

## Cấu hình môi trường

Tạo file `.env.local` ở thư mục gốc:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Tùy chọn khác nếu dùng đến
# OPENAI_API_KEY=
```

> Không commit `SUPABASE_SERVICE_ROLE_KEY`. Chỉ dùng ở server-side.

---

## Chạy dự án

- Development:

```bash
npm run dev
```

- Build & start production:

```bash
npm run build
npm start
```

- Truy cập: http://localhost:3000

---

## Phân quyền Admin/User

- Client (trang `/admin`): sử dụng `requireAdminAccess()` từ `lib/auth-helpers.client.ts` để kiểm tra quyền, nếu không phải admin sẽ redirect khỏi trang.
- Server/API: sử dụng `requireAdminAPI()` từ `lib/auth-helpers.server.ts` để bảo vệ tất cả API dưới `app/api/admin/*`.
- Quyền “admin” được lưu tại `profiles.role`.

---

## API Admin

- `POST /api/admin/process-json` — Xử lý JSON có cấu trúc để tạo khóa học
- `POST /api/admin/process-pdf` — Phân tích cấu trúc PDF
- `POST /api/admin/batch-process-pdfs` — Xử lý hàng loạt tài liệu
- `GET  /api/admin/batch-progress/[progressId]` — Lấy tiến độ xử lý

Tất cả API trên yêu cầu user là admin (được kiểm tra trong `requireAdminAPI()`).

---

## Troubleshooting

- 500 khi gọi `/rest/v1/profiles`, lỗi `42P17 infinite recursion detected`:
  - Nguyên nhân: RLS policy truy vấn lại chính bảng `profiles` → đệ quy vô hạn
  - Cách khắc phục: Dùng bộ policy tối giản ở mục [Thiết lập Supabase](#thiết-lập-supabase)

- Lỗi hydration/hydration error khi client import server-only:
  - Nguyên nhân: import `next/headers`/server client vào client component
  - Khắc phục: tách helper thành `auth-helpers.client.ts` và `auth-helpers.server.ts`

- Lỗi ghi file Buffer khi xử lý upload:
  - Khắc phục: cast `Buffer` về `Uint8Array` trước khi ghi file trong API routes

---

## Scripts

```json
npm run dev     # Chạy development server
npm run build   # Build production
npm start       # Chạy production server
npm run lint    # ESlint
npm run test:pdf # Test dịch vụ phân tích PDF (nếu có script)
```

---

## Thư mục & cấu trúc

```
app/
  (main)/admin/page.tsx           # Trang admin (client)
  api/
    admin/
      process-json/route.ts       # API xử lý JSON (admin)
      process-pdf/route.ts        # API xử lý PDF (admin)
      batch-process-pdfs/route.ts # API batch (admin)
      batch-progress/[id]/route.ts# API tiến độ (admin)
lib/
  supabase/
    client.ts                     # Supabase client (browser)
    server.ts                     # Supabase client (server)
  auth-helpers.client.ts          # Client helpers (kiểm tra quyền)
  auth-helpers.server.ts          # Server helpers (bảo vệ API)
  services/                       # Phân tích tài liệu, batch-progress, v.v.
```

---

## Góp ý & phát triển

- Tạo feature branch từ `feature/AccAdmin`
- Mở Pull Request kèm mô tả chức năng/bugfix
- Đính kèm tài liệu/SQL nếu thay đổi database

---

## License

MIT
