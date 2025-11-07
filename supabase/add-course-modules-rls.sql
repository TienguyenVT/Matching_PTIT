-- =====================================================
-- RLS POLICIES CHO COURSE_MODULES
-- Phiên bản: 1.0 - Ngày: 2025-01-XX
-- =====================================================
-- Mục đích: Cập nhật RLS policies cho course_modules (đã bao gồm trong migration chính)
-- File này chỉ để tham khảo hoặc chạy riêng nếu cần
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu cập nhật RLS policies cho course_modules...';
END $$;

-- Enable RLS (nếu chưa enable)
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

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
  RAISE NOTICE '✅ Hoàn thành: Cập nhật RLS policies cho course_modules';
END $$;

