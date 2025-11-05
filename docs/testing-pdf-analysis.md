# Hướng dẫn Test: Xử lý JSON (AI sinh Quiz)

Hướng dẫn chi tiết để test tính năng xử lý file JSON có cấu trúc chương/mục. AI chỉ dùng để sinh 10 câu quiz cho mỗi chương.

## Chuẩn bị

### 1. Kiểm tra môi trường

Đảm bảo các bước sau đã hoàn thành:

```bash
# 1. Cài đặt dependencies
npm install

# 2. Kiểm tra file .env.local có đầy đủ:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - GEMINI_API_KEY=AIzaSyB8u7HVbUx35phyF5VlOQInvdvNNWW5C_Y
```

### 2. Setup Database

Đảm bảo đã chạy migration:

1. Mở Supabase Dashboard → SQL Editor
2. Chạy file `supabase/add-course-modules.sql`
3. Verify bảng `course_modules` đã được tạo:
   ```sql
   SELECT * FROM course_modules LIMIT 5;
   ```

### 3. Đặt file JSON vào documents/

```bash
mkdir -p uploads/pdfs
```

## Test Case 1: JSON nhỏ

### Bước 1: Chuẩn bị JSON test

1. Tạo hoặc chọn một file JSON có cấu trúc rõ ràng: mảng `data`, các chương và các mục có `content`.
2. Đặt file vào folder `documents/`

### Bước 2: Test qua Admin Interface

1. **Khởi động server**:
   ```bash
   npm run dev
   ```

2. **Truy cập trang admin**:
   - Mở browser: `http://localhost:3000/admin`
   - Đăng nhập nếu chưa

3. (Tùy chọn) Upload qua UI nếu có endpoint JSON tương ứng

4. **Kiểm tra kết quả**:
   - Alert sẽ hiển thị số học phần và bài học được tạo
   - Ghi nhớ `course_id` từ alert hoặc console

### Bước 3: Verify trong Database

1. **Kiểm tra course được tạo**:
   ```sql
   SELECT id, title, description, level, created_at 
   FROM courses 
   WHERE title LIKE '%Test PDF nhỏ%'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

2. **Kiểm tra modules (học phần)**:
   ```sql
   SELECT id, title, chapter_number, order_index, description
   FROM course_modules
   WHERE course_id = 'YOUR_COURSE_ID_HERE'
   ORDER BY order_index;
   ```

3. **Kiểm tra contents (bài học)**:
   ```sql
   SELECT 
     cc.id, 
     cc.title, 
     cc.kind, 
     cc.order_index,
     cc.module_id,
     cm.title as module_title
   FROM course_contents cc
   LEFT JOIN course_modules cm ON cc.module_id = cm.id
   WHERE cc.course_id = 'YOUR_COURSE_ID_HERE'
   ORDER BY cc.order_index;
   ```

4. **Kiểm tra cấu trúc phân cấp**:
   ```sql
   SELECT 
     cm.title as module_title,
     cm.chapter_number,
     COUNT(cc.id) as lesson_count
   FROM course_modules cm
   LEFT JOIN course_contents cc ON cc.module_id = cm.id
   WHERE cm.course_id = 'YOUR_COURSE_ID_HERE'
   GROUP BY cm.id, cm.title, cm.chapter_number
   ORDER BY cm.order_index;
   ```

### Bước 4: Verify trong UI

1. **Kiểm tra trang course detail**:
   - Truy cập: `http://localhost:3000/course/{course_id}/detail`
   - Verify sidebar hiển thị đúng các học phần
   - Click vào học phần để expand và xem các bài học
   - Verify bài học được sắp xếp đúng thứ tự

2. **Kiểm tra trang learn**:
   - Truy cập: `http://localhost:3000/course/{course_id}/learn`
   - Verify sidebar hiển thị modules và lessons
   - Verify cấu trúc phân cấp đúng

### Kết quả mong đợi

- ✅ Course được tạo với đúng thông tin
- ✅ Modules (học phần) được tạo theo số chương từ JSON
- ✅ Contents (bài học) được tạo theo các mục có `content`
- ✅ Mỗi content có `module_id` trỏ đến đúng module
- ✅ UI hiển thị đúng cấu trúc phân cấp

## Test Case 2: Batch nhiều JSON

### Bước 1: Chuẩn bị PDF lớn

1. Đặt nhiều file JSON trong folder `documents/`

### Bước 2: Test qua Batch Processing

1. **Đảm bảo file PDF đã có trong folder documents/**:
   ```bash
   ls -lh documents/*.pdf
   ```

2. **Truy cập trang admin**:
   - `http://localhost:3000/admin`

3. **Chạy batch processing**:
   - Click nút "Xử lý batch (JSON)"
   - Xác nhận dialog
   - Đợi xử lý (có thể mất 5-15 phút tùy số lượng file và kích thước)

4. **Monitor progress**:
   - Xem console logs để theo dõi tiến trình
   - Mỗi file sẽ được xử lý tuần tự
   - Delay 2 giây giữa các file để tránh rate limit

### Bước 3: Verify kết quả batch

1. **Kiểm tra summary**:
   - Alert sẽ hiển thị:
     - Tổng số file
     - Số file thành công
     - Số file thất bại
     - Tổng học phần và bài học

2. **Kiểm tra từng file**:
   ```sql
   -- Xem tất cả courses được tạo từ batch
   SELECT 
     id, 
     title, 
     description, 
     created_at,
     (SELECT COUNT(*) FROM course_modules WHERE course_id = courses.id) as module_count,
     (SELECT COUNT(*) FROM course_contents WHERE course_id = courses.id) as content_count
   FROM courses
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

3. **Kiểm tra một course cụ thể**:
   ```sql
   -- Thay YOUR_COURSE_ID bằng ID thực tế
   SELECT 
     c.title as course_title,
     COUNT(DISTINCT cm.id) as total_modules,
     COUNT(cc.id) as total_lessons,
     AVG(module_lessons.lesson_count) as avg_lessons_per_module
   FROM courses c
   LEFT JOIN course_modules cm ON cm.course_id = c.id
   LEFT JOIN course_contents cc ON cc.module_id = cm.id
   LEFT JOIN (
     SELECT module_id, COUNT(*) as lesson_count
     FROM course_contents
     GROUP BY module_id
   ) module_lessons ON module_lessons.module_id = cm.id
   WHERE c.id = 'YOUR_COURSE_ID'
   GROUP BY c.id, c.title;
   ```

### Ghi chú
Batch chỉ đọc JSON, không xử lý hoặc convert PDF.

### Kết quả mong đợi

- ✅ Tất cả JSON trong folder được xử lý
- ✅ Cấu trúc chapters và sections được phân tích theo JSON
- ✅ Không có lỗi rate limit hoặc timeout
- ✅ Tất cả courses được tạo thành công

## Test Case 3: Error Handling

### Test các trường hợp lỗi

1. **JSON không hợp lệ**:
   - File rỗng hoặc sai cú pháp
   - Expected: Thông báo lỗi JSON không hợp lệ / rỗng

2. **Thiếu dữ liệu**:
   - JSON thiếu `data` hoặc không có `content`
   - Expected: Skip với thông báo lỗi rõ ràng

3. **Cấu trúc JSON không rõ ràng**:
   - Expected: Skip file với thông báo lỗi

4. **Gemini API key không hợp lệ**:
   - Thay `GEMINI_API_KEY` bằng key sai
   - Expected: Error message về API key

5. **Network timeout**:
   - Test với PDF rất lớn trong môi trường network chậm
   - Expected: Retry logic hoặc timeout error

## Debugging

### Kiểm tra logs

1. **Server logs**:
   ```bash
   # Xem logs trong terminal khi chạy npm run dev
   # Tìm các log:
   # - [PDF Analysis] Starting analysis...
   # - [PDF Analysis] Extracted X pages...
   # - [Gemini] Processing chunk X/Y...
   ```

2. **Browser console**:
   - Mở DevTools (F12)
   - Xem tab Console và Network
   - Kiểm tra API responses

3. **Database logs**:
   - Kiểm tra Supabase Dashboard → Logs
   - Xem có query errors không

### Common Issues

1. **Module không có contents**:
   - Nguyên nhân: PDF không có mục trong chương
   - Giải pháp: Kiểm tra cấu trúc PDF, có thể cần điều chỉnh prompt

2. **Chapters bị duplicate**:
   - Nguyên nhân: Merge logic khi xử lý chunks
   - Giải pháp: Kiểm tra logic merge trong `analyzeLargePDF`

3. **Rate limit từ Gemini**:
   - Nguyên nhân: Quá nhiều requests trong thời gian ngắn
   - Giải pháp: Tăng delay giữa các requests

4. **PDF parse error**:
   - Nguyên nhân: PDF corrupted hoặc format không chuẩn
   - Giải pháp: Kiểm tra file PDF, thử với PDF khác

## Checklist Test

### Test PDF nhỏ
- [ ] Upload thành công
- [ ] Course được tạo
- [ ] Modules (học phần) được tạo đúng số chương
- [ ] Contents (bài học) được tạo đúng số mục
- [ ] UI hiển thị đúng cấu trúc
- [ ] Foreign keys đúng (module_id trong contents)

### Test PDF lớn
- [ ] PDF được chia thành chunks
- [ ] Tất cả chunks được xử lý
- [ ] Chapters được merge đúng
- [ ] Không có duplicate
- [ ] Order_index đúng
- [ ] Không có timeout errors

### Test Batch Processing
- [ ] Tất cả PDF trong folder được xử lý
- [ ] Summary hiển thị đúng
- [ ] Không có file nào bị skip (trừ duplicate)
- [ ] Error handling đúng cho file lỗi

### Test Error Cases
- [ ] Invalid file type → Error message
- [ ] File too large → Error message
- [ ] Invalid API key → Error message
- [ ] Network timeout → Error/Retry

## Tips

1. **Bắt đầu với JSON nhỏ** để verify logic hoạt động
2. **Sử dụng JSON có cấu trúc rõ ràng** để có kết quả tốt nhất
3. **Kiểm tra logs** khi có lỗi để debug
4. **Verify database** trực tiếp để đảm bảo dữ liệu đúng
5. **Test từng bước** một cách tuần tự

## Troubleshooting

### Lỗi thường gặp

1. **"JSON không hợp lệ"**:
   - Kiểm tra JSON có hợp lệ không, có mảng `data` hay không
   - Xem logs chi tiết

2. **"Rate limit exceeded"**:
   - Đợi vài phút rồi thử lại
   - Tăng delay trong code

3. **"Module không có contents"**:
   - Kiểm tra PDF có cấu trúc mục không
   - Có thể cần điều chỉnh prompt cho Gemini

4. **"Database error"**:
   - Kiểm tra migration đã chạy chưa
   - Kiểm tra RLS policies
   - Verify service role key

