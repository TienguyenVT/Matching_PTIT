# ĐTSV 1:1 Learning - Next.js + Supabase

Hệ thống đăng ký khóa học và học 1:1 với nhau, sử dụng Next.js App Router và Supabase.

## Công nghệ

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Realtime, Storage)
- **Deploy**: Vercel
- **Video Call**: Daily.co (tùy chọn)

## Setup nhanh

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Tạo file `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DAILY_API_KEY=your_daily_api_key  # Tùy chọn, sẽ mock nếu không có
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Setup Supabase Database

1. Mở [Supabase Dashboard](https://supabase.com/dashboard)
2. Vào **SQL Editor**
3. Copy **TOÀN BỘ** nội dung file `supabase/complete-setup.sql`
4. Paste và chạy (RUN)
5. Đợi kết quả "SETUP COMPLETED"

### 4. Bật Realtime cho chat

1. Database → Replication
2. Bật cho bảng `chat_messages`

### 5. Tạo Storage bucket

1. Storage → New bucket
2. Tên bucket: `chat-uploads`
3. Chọn **Public** bucket
4. Tạo bucket

### 6. Chạy dev server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

## Tính năng

### ✅ Đã hoàn thành

- [x] Đăng ký/Đăng nhập (Email + Google OAuth)
- [x] Dashboard với danh sách khóa học (đã đăng ký + khả dụng)
- [x] Đăng ký khóa học (giới hạn 2 khóa/user)
- [x] Xem chi tiết khóa học
- [x] Xem nội dung khóa học (video, tài liệu)
- [x] Matching 1:1 trong khóa học
- [x] Chat realtime với Supabase Realtime
- [x] Upload file (ảnh, video, audio, document) trong chat
- [x] RLS policies bảo mật
- [x] API serverless cho nghiệp vụ nhạy cảm

### 🚧 Cần bổ sung

- [ ] Video call integration (Daily.co hoặc alternative)
- [ ] Quiz/Test feature
- [ ] Notifications
- [ ] User profile
- [ ] Admin dashboard

## Notes

- Daily.co API key có thể để trống → hệ thống sẽ mock URL room
- Supabase RLS đã được cấu hình để bảo mật dữ liệu
- Storage bucket `chat-uploads` cần được tạo và set public
