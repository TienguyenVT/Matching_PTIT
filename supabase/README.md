# Supabase Database Setup

## 🚀 Setup nhanh

### Bước 1: Mở Supabase Dashboard
Truy cập: https://supabase.com/dashboard

### Bước 2: Chạy script setup
1. Vào **SQL Editor** (thanh bên trái)
2. Click **New Query**
3. Copy **TOÀN BỘ** nội dung file **`complete-setup.sql`** ở thư mục này
4. Paste vào editor
5. Click **RUN** (hoặc Ctrl+Enter)

### Bước 3: Kiểm tra kết quả

**Trong Messages panel** (mặc định ở dưới SQL Editor), bạn sẽ thấy log theo từng bước:
```
🚀 BẮT ĐẦU SETUP DATABASE...
================================
✅ Hoàn thành: Tạo Extensions (uuid-ossp, pgcrypto)
✅ Hoàn thành: Tạo tất cả tables (...)
✅ Hoàn thành: Bật RLS cho tất cả tables
✅ Hoàn thành: Tạo tất cả RLS policies
✅ Hoàn thành: Trigger auto-create profile (0 users được fix)
📦 Bắt đầu seed dữ liệu courses và contents...
✅ Hoàn thành: Seed courses (11 active courses)
✅ Hoàn thành: Seed course contents (35 contents)

================================
🎉 HOÀN TẤT SETUP DATABASE
================================
```

**Trong Results panel** (kết quả query), bạn sẽ thấy bảng tóm tắt:
```
status                 | active_courses | total_contents | total_profiles | total_policies
-----------------------|----------------|----------------|----------------|----------------
✅ SETUP COMPLETED     | 11             | 35             | ...            | 28
```

Và danh sách tất cả courses cùng với course contents của course `b2eb844d-9803-4ef3-af53-7568a9d5cd1d`.

## 📁 File structure

```
supabase/
├── README.md                  ← Bạn đang đọc file này
└── complete-setup.sql        ← 🎯 FILE DUY NHẤT - Chạy file này trong Supabase
```

**Lưu ý**: Tất cả migration files đã được gộp vào `complete-setup.sql`. Không cần chạy riêng lẻ từng file.

## ⚠️ Lưu ý

1. **Chỉ cần chạy `complete-setup.sql` một lần** - Nó đã bao gồm tất cả migrations và seed data
2. Nếu database đã có dữ liệu cũ, script sẽ dùng `ON CONFLICT DO UPDATE` để cập nhật
3. Sau khi chạy xong, nhớ:
   - Bật Realtime cho bảng `chat_messages` (Database → Replication)
   - Tạo Storage bucket `chat-uploads` (Storage → New bucket → Public)

## 🔧 Nếu có lỗi

### Lỗi: "policy already exists"
→ **Bỏ qua**, script đã dùng `DROP POLICY IF EXISTS`

### Lỗi: "enum already exists"
→ **Bỏ qua**, script đã dùng `IF NOT EXISTS`

### Lỗi: "relation already exists"
→ **Bỏ qua**, script đã dùng `CREATE TABLE IF NOT EXISTS`

### Lỗi: "permission denied"
→ Bạn không có quyền `service_role` hoặc đang dùng `anon key`

## 📊 Verify data

Sau khi setup, chạy các query sau để kiểm tra:

```sql
-- Xem tất cả courses
SELECT id, title, level, is_active FROM courses ORDER BY created_at DESC;

-- Xem course contents của một khóa học
SELECT cc.* FROM course_contents cc 
JOIN courses c ON cc.course_id = c.id 
WHERE c.id = 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d' 
ORDER BY cc.order_index;

-- Xem RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

## 🔐 RLS Policies summary

| Table | Policy | Mục đích |
|-------|--------|----------|
| `courses` | `courses read active` | Public đọc active courses |
| `course_contents` | `contents active courses select` | Authenticated users xem contents (kể cả chưa enrolled) |
| `profiles` | `profiles self *` | User chỉ xem/sửa chính mình |
| `user_courses` | `user_courses owner *` | User quản lý đăng ký khóa học của mình |
| `chat_rooms` | `rooms members select` | Chỉ members mới thấy phòng |
| `chat_members` | `members_access` | User chỉ thao tác với chính mình |
| `chat_messages` | `messages *` | Chỉ members mới đọc/ghi message |

