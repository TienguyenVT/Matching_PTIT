-- =====================================================
-- MIGRATION: THÊM BẢNG LƯU NỘI DUNG CHI TIẾT CHO BÀI HỌC VÀ BÀI KIỂM TRA
-- Phiên bản: 1.0 - Ngày: 2025-01-XX
-- =====================================================
-- Mục đích: Tạo bảng để lưu nội dung chi tiết của bài học (doc) và bài kiểm tra (quiz)
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Thêm bảng lưu nội dung chi tiết...';
END $$;

-- =====================================================
-- PHẦN 1: TẠO BẢNG LESSON_CONTENT (Nội dung bài học)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lesson_content (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id uuid NOT NULL REFERENCES public.course_contents(id) ON DELETE CASCADE,
  content_text text NOT NULL, -- Nội dung chi tiết của bài học
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_content_content_id ON public.lesson_content(content_id);

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo bảng lesson_content';
END $$;

-- =====================================================
-- PHẦN 2: TẠO BẢNG QUIZ_CONTENT (Nội dung bài kiểm tra)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.quiz_content (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id uuid NOT NULL REFERENCES public.course_contents(id) ON DELETE CASCADE,
  questions jsonb NOT NULL, -- Mảng các câu hỏi trắc nghiệm
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_content_content_id ON public.quiz_content(content_id);

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo bảng quiz_content';
END $$;

-- =====================================================
-- PHẦN 3: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.lesson_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_content ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Bật RLS cho lesson_content và quiz_content';
END $$;

-- =====================================================
-- PHẦN 4: RLS POLICIES
-- =====================================================

-- Lesson content policies: cho phép authenticated users xem nội dung của active courses
DROP POLICY IF EXISTS "lesson_content active courses select" ON public.lesson_content;
CREATE POLICY "lesson_content active courses select" ON public.lesson_content
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.course_contents cc
      JOIN public.courses c ON cc.course_id = c.id
      WHERE cc.id = lesson_content.content_id 
      AND c.is_active = true
    )
  );

-- Quiz content policies: cho phép authenticated users xem quiz của active courses
DROP POLICY IF EXISTS "quiz_content active courses select" ON public.quiz_content;
CREATE POLICY "quiz_content active courses select" ON public.quiz_content
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.course_contents cc
      JOIN public.courses c ON cc.course_id = c.id
      WHERE cc.id = quiz_content.content_id 
      AND c.is_active = true
    )
  );

-- Policies cho insert/update (cho admin)
DROP POLICY IF EXISTS "lesson_content authenticated insert" ON public.lesson_content;
CREATE POLICY "lesson_content authenticated insert" ON public.lesson_content
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lesson_content authenticated update" ON public.lesson_content;
CREATE POLICY "lesson_content authenticated update" ON public.lesson_content
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quiz_content authenticated insert" ON public.quiz_content;
CREATE POLICY "quiz_content authenticated insert" ON public.quiz_content
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quiz_content authenticated update" ON public.quiz_content;
CREATE POLICY "quiz_content authenticated update" ON public.quiz_content
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo RLS policies cho lesson_content và quiz_content';
END $$;

-- =====================================================
-- PHẦN 5: VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE '🎉 HOÀN TẤT MIGRATION';
  RAISE NOTICE '================================';
END $$;

-- Kiểm tra kết quả
SELECT 
  '✅ MIGRATION COMPLETED' as status,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lesson_content') as lesson_content_table_exists,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quiz_content') as quiz_content_table_exists;

