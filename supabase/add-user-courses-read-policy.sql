-- =====================================================
-- MIGRATION: THÊM RLS POLICY ĐỂ CHO PHÉP ĐỌC USER_COURSES CỦA USERS KHÁC
-- =====================================================
-- Mục đích: Cho phép authenticated users đọc user_courses của users khác
--           để tính toán số khóa học chung và matching
-- Ngày: 2025-11-01
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Thêm RLS policy để đọc user_courses của users khác...';
END $$;

-- =====================================================
-- BƯỚC 1: Thêm policy cho phép authenticated users đọc user_courses
-- =====================================================

-- Policy này cho phép authenticated users đọc user_courses của users khác
-- (chỉ để tính toán khóa học chung và matching, không phải toàn bộ thông tin)
DROP POLICY IF EXISTS "user_courses authenticated users can read" ON public.user_courses;
CREATE POLICY "user_courses authenticated users can read" ON public.user_courses
  FOR SELECT 
  USING (
    -- Cho phép nếu:
    -- 1. User đang xem chính courses của mình (đã có policy cũ)
    -- HOẶC
    -- 2. User đã authenticated (có auth.uid() không null) - để matching và search
    auth.uid() IS NOT NULL
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Đã thêm policy "user_courses authenticated users can read"';
END $$;

-- =====================================================
-- HOÀN TẤT MIGRATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE '🎉 HOÀN TẤT MIGRATION';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Bây giờ authenticated users có thể đọc user_courses của users khác';
  RAISE NOTICE 'để tính toán số khóa học chung và matching';
END $$;

-- Kiểm tra policies hiện có
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_courses'
ORDER BY policyname;

