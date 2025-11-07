-- =====================================================
-- MIGRATION: THÊM BẢNG COURSE_MODULES VÀ CẬP NHẬT COURSE_CONTENTS
-- Phiên bản: 1.0 - Ngày: 2025-01-XX
-- =====================================================
-- Mục đích: Tạo bảng course_modules để lưu học phần (chương) và cập nhật course_contents để liên kết với modules
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Thêm bảng course_modules...';
END $$;

-- =====================================================
-- PHẦN 1: TẠO BẢNG COURSE_MODULES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  chapter_number int,
  description text,
  order_index int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Tạo index để tối ưu query
CREATE INDEX IF NOT EXISTS idx_course_modules_course_order ON public.course_modules(course_id, order_index);

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo bảng course_modules';
END $$;

-- =====================================================
-- PHẦN 2: CẬP NHẬT BẢNG COURSE_CONTENTS
-- =====================================================

-- Thêm cột module_id vào course_contents (nullable để backward compatible)
ALTER TABLE public.course_contents 
ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.course_modules(id) ON DELETE SET NULL;

-- Tạo index cho module_id
CREATE INDEX IF NOT EXISTS idx_course_contents_module ON public.course_contents(module_id);

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Cập nhật bảng course_contents với module_id';
END $$;

-- =====================================================
-- PHẦN 3: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Bật RLS cho course_modules';
END $$;

-- =====================================================
-- PHẦN 4: RLS POLICIES CHO COURSE_MODULES
-- =====================================================

-- Policy cho phép authenticated users xem modules của active courses
DROP POLICY IF EXISTS "modules active courses select" ON public.course_modules;
CREATE POLICY "modules active courses select" ON public.course_modules
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_modules.course_id 
      AND c.is_active = true
    )
  );

-- Policy cho phép authenticated users insert modules (cho admin)
DROP POLICY IF EXISTS "modules authenticated insert" ON public.course_modules;
CREATE POLICY "modules authenticated insert" ON public.course_modules
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Policy cho phép authenticated users update modules (cho admin)
DROP POLICY IF EXISTS "modules authenticated update" ON public.course_modules;
CREATE POLICY "modules authenticated update" ON public.course_modules
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy cho phép authenticated users delete modules (cho admin)
DROP POLICY IF EXISTS "modules authenticated delete" ON public.course_modules;
CREATE POLICY "modules authenticated delete" ON public.course_modules
  FOR DELETE 
  USING (auth.role() = 'authenticated');

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo RLS policies cho course_modules';
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
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'course_modules') as course_modules_table_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'course_contents' AND column_name = 'module_id') as module_id_column_exists;

