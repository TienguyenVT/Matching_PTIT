# Hướng dẫn Migration Database

## Tổng quan

Migration này thêm các bảng mới để lưu nội dung chi tiết của bài học và bài kiểm tra được sinh tự động bởi AI.

## Các bảng mới

1. **lesson_content**: Lưu nội dung chi tiết của bài học (doc)
2. **quiz_content**: Lưu câu hỏi trắc nghiệm của bài kiểm tra (quiz)

## Cách chạy migration

### Bước 1: Chạy migration SQL

1. Mở Supabase Dashboard
2. Vào **SQL Editor**
3. Copy và paste nội dung từ file `supabase/add-course-content-details.sql`
4. Click **Run** để chạy migration

Hoặc nếu bạn có Supabase CLI:

```bash
supabase db reset
# hoặc
supabase migration new add_course_content_details
# Copy nội dung vào file migration mới
supabase db push
```

### Bước 2: Verify migration

Sau khi chạy migration, kiểm tra các bảng đã được tạo:

```sql
-- Kiểm tra bảng lesson_content
SELECT * FROM lesson_content LIMIT 1;

-- Kiểm tra bảng quiz_content
SELECT * FROM quiz_content LIMIT 1;

-- Kiểm tra RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('lesson_content', 'quiz_content');
```

## Cấu trúc dữ liệu

### lesson_content

```sql
CREATE TABLE lesson_content (
  id uuid PRIMARY KEY,
  content_id uuid REFERENCES course_contents(id),
  content_text text NOT NULL,  -- HTML content
  created_at timestamp,
  updated_at timestamp
);
```

### quiz_content

```sql
CREATE TABLE quiz_content (
  id uuid PRIMARY KEY,
  content_id uuid REFERENCES course_contents(id),
  questions jsonb NOT NULL,  -- Array of quiz questions
  created_at timestamp,
  updated_at timestamp
);
```

### Format của questions trong quiz_content

```json
{
  "questions": [
    {
      "question": "Câu hỏi?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Giải thích"
    }
  ]
}
```

## Sau khi migration

1. **Xóa dữ liệu cũ** (nếu cần): Nếu bạn đã chạy batch processing trước đó và không có modules/contents, bạn cần:
   - Xóa các courses đã tạo từ PDF (nhưng không có modules)
   - Chạy lại batch processing

2. **Chạy lại batch processing**:
   - Vào trang Admin: `/admin`
   - Click "Xử lý Batch Tất cả PDF"
   - Đợi quá trình xử lý hoàn tất

3. **Kiểm tra kết quả**:
   - Vào trang chi tiết khóa học
   - Kiểm tra xem có modules và contents không
   - Click vào một bài học để xem nội dung chi tiết
   - Click vào một bài kiểm tra để xem câu hỏi

## Troubleshooting

### Lỗi: "relation lesson_content does not exist"

**Nguyên nhân**: Migration chưa được chạy.

**Giải pháp**: Chạy lại file migration SQL.

### Lỗi: "permission denied for table lesson_content"

**Nguyên nhân**: RLS policy chưa được thiết lập đúng.

**Giải pháp**: Kiểm tra và chạy lại phần RLS policies trong migration.

### Không có modules/contents sau khi batch processing

**Nguyên nhân có thể**:
1. PDF không có cấu trúc chương rõ ràng
2. Gemini API không trả về đúng cấu trúc
3. Lỗi khi insert vào database

**Giải pháp**:
1. Kiểm tra console logs khi batch processing
2. Kiểm tra xem có lỗi trong Supabase logs không
3. Thử với một PDF nhỏ hơn để test

## Liên quan

- Xem [QUICK_TEST_GUIDE.md](./QUICK_TEST_GUIDE.md) để test nhanh
- Xem [testing-pdf-analysis.md](./testing-pdf-analysis.md) để test chi tiết

