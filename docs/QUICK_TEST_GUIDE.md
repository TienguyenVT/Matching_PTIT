# Hướng dẫn Test Nhanh - Xử lý JSON

## Test nhanh trong 5 phút

### Bước 1: Chuẩn bị (1 phút)

```bash
# 1. Cài đặt dependencies
npm install

# 2. Cài đặt tsx để chạy test script (nếu chưa có)
npm install -D tsx

# 3. Kiểm tra .env.local có GEMINI_API_KEY
cat .env.local | grep GEMINI_API_KEY
```

### Bước 2: Chạy migration (1 phút)

1. Mở Supabase Dashboard → SQL Editor
2. Chạy file `supabase/add-course-modules.sql`
3. Verify: `SELECT * FROM course_modules LIMIT 1;`

### Bước 3: Test với JSON nhỏ (2 phút)

Đặt 1-2 file JSON mẫu vào `documents/` theo cấu trúc chương/mục.

**Cách 2: Test qua UI**

1. Khởi động server:
   ```bash
   npm run dev
   ```

2. Truy cập: `http://localhost:3000/admin`

3. (Tùy chọn) Upload theo UI nếu có endpoint tương ứng

4. Điền thông tin:
   - Tên khóa học: "Test PDF"
   - Mô tả: "Test"
   - Cấp độ: "Beginner"

5. Bỏ qua bước upload nếu không cần

6. Đợi kết quả (30-60 giây)

### Bước 4: Verify kết quả (1 phút)

**Kiểm tra trong Supabase Dashboard:**

```sql
-- 1. Xem course vừa tạo
SELECT id, title, created_at 
FROM courses 
ORDER BY created_at DESC 
LIMIT 1;

-- 2. Xem modules (thay YOUR_COURSE_ID)
SELECT title, chapter_number, order_index
FROM course_modules
WHERE course_id = 'YOUR_COURSE_ID'
ORDER BY order_index;

-- 3. Xem contents (thay YOUR_COURSE_ID)
SELECT 
  cc.title, 
  cc.order_index,
  cm.title as module_title
FROM course_contents cc
LEFT JOIN course_modules cm ON cc.module_id = cm.id
WHERE cc.course_id = 'YOUR_COURSE_ID'
ORDER BY cc.order_index
LIMIT 20;
```

**Kiểm tra trong UI:**

1. Truy cập: `http://localhost:3000/course/{course_id}/detail`
2. Verify sidebar hiển thị các học phần
3. Click vào học phần để xem bài học
4. Verify cấu trúc phân cấp đúng

### Kết quả mong đợi

✅ Course được tạo  
✅ Modules (học phần) được tạo  
✅ Contents (bài học) được tạo  
✅ UI hiển thị đúng cấu trúc  

## Test batch JSON

### Bước 1: Chạy batch processing

1. Đảm bảo có nhiều file JSON trong folder `documents/`
2. Truy cập: `http://localhost:3000/admin`
3. Click "Xử lý batch (JSON)"
4. Đợi xử lý (5-15 phút)

### Bước 2: Verify kết quả

```sql
-- Xem tất cả courses được tạo
SELECT 
  id, 
  title,
  (SELECT COUNT(*) FROM course_modules WHERE course_id = courses.id) as modules,
  (SELECT COUNT(*) FROM course_contents WHERE course_id = courses.id) as contents
FROM courses
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## Troubleshooting nhanh

**Lỗi: "JSON không hợp lệ"**
- Kiểm tra file JSON có đúng cú pháp không
- Đảm bảo có mảng `data` và nội dung chương/mục

**Lỗi: "Module không có contents"**
- JSON có thể thiếu `content` ở các mục
- Bổ sung `content` hoặc chia nhỏ sections rõ ràng hơn

**Lỗi: "Rate limit exceeded"**
- Đợi vài phút rồi thử lại
- Hoặc giảm số lượng file trong batch

**Lỗi: "Database error"**
- Kiểm tra migration đã chạy chưa
- Kiểm tra RLS policies

## Xem hướng dẫn chi tiết

Xem file [testing-pdf-analysis.md](./testing-pdf-analysis.md) để có hướng dẫn test đầy đủ với các test cases chi tiết.

