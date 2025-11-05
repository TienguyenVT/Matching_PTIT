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
GEMINI_API_KEY=your_gemini_api_key  # API key cho Google Gemini AI
DAILY_API_KEY=your_daily_api_key  # Tùy chọn, sẽ mock nếu không có
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Setup Supabase Database

1. Mở [Supabase Dashboard](https://supabase.com/dashboard)
2. Vào **SQL Editor**
3. Copy **TOÀN BỘ** nội dung file `supabase/complete-setup.sql`
4. Paste và chạy (RUN)
5. Đợi kết quả "SETUP COMPLETED"
6. Chạy migration cho course_modules:
   - Copy nội dung file `supabase/add-course-modules.sql`
   - Paste và chạy (RUN)

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
- [x] **AI phân tích tài liệu JSON** - Tự động tạo cấu trúc học phần/bài học từ file JSON
- [x] **Admin interface** - Xử lý batch các file JSON từ folder documents

### 🚧 Cần bổ sung

- [ ] Video call integration (Daily.co hoặc alternative)
- [ ] Quiz/Test feature
- [ ] Notifications
- [ ] User profile

## Tính năng xử lý tài liệu JSON

Hệ thống hỗ trợ sử dụng file JSON có cấu trúc chương/mục để tạo khóa học:

### Cách sử dụng

1. **Upload PDF qua Admin Interface**:
   - Truy cập `/admin` (cần đăng nhập)
   - Upload file PDF (tối đa 50MB)
   - Nhập thông tin khóa học (tên, mô tả, cấp độ)
   - Hệ thống sẽ tự động phân tích và tạo:
     - Học phần (modules) theo chương trong PDF
     - Bài học (lessons) theo mục trong mỗi chương

2. **Xử lý batch từ folder documents**:
   - Click nút "Xử lý batch (JSON)" trong trang admin
   - Hệ thống sẽ tự động xử lý tất cả file JSON trong folder `documents/`
   - Tạo khóa học tương ứng với tên file JSON

### Yêu cầu

- Google Gemini API key (đặt trong `.env.local` với key `GEMINI_API_KEY`) – dùng để sinh Quiz 10 câu cho mỗi chương
- File JSON cần theo mẫu (ví dụ trong `documents/`), có cấu trúc chương/mục rõ ràng

### Cấu trúc Database

- `course_modules`: Lưu học phần (chương)
- `course_contents`: Lưu bài học (mục) với foreign key đến `course_modules`

### Hướng dẫn Test

Xem file [docs/testing-pdf-analysis.md](./docs/testing-pdf-analysis.md) để có hướng dẫn chi tiết (đã cập nhật cho JSON).

**Quick test**:
```bash
# Cài đặt tsx nếu chưa có
npm install -D tsx

# Chạy script test
npm run test:pdf
```

## Notes

- Daily.co API key có thể để trống → hệ thống sẽ mock URL room
- Supabase RLS đã được cấu hình để bảo mật dữ liệu
- Storage bucket `chat-uploads` cần được tạo và set public
