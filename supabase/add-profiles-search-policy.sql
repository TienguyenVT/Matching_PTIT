-- =====================================================
-- MIGRATION: THÊM RLS POLICY ĐỂ CHO PHÉP TÌM KIẾM PROFILES
-- =====================================================
-- Mục đích: Cho phép authenticated users tìm kiếm profiles của người khác
-- Ngày: 2025-11-01
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Thêm RLS policy cho tìm kiếm profiles...';
END $$;

-- =====================================================
-- BƯỚC 1: Thêm policy cho phép authenticated users đọc profiles
-- =====================================================

-- Policy này cho phép authenticated users đọc profiles của người khác
-- (để tìm kiếm và matching)
DROP POLICY IF EXISTS "profiles authenticated users can read" ON public.profiles;
CREATE POLICY "profiles authenticated users can read" ON public.profiles
  FOR SELECT 
  USING (
    -- Cho phép nếu:
    -- 1. User đang xem chính profile của mình (đã có policy cũ)
    -- HOẶC
    -- 2. User đã authenticated (có auth.uid() không null)
    auth.uid() IS NOT NULL
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Đã thêm policy "profiles authenticated users can read"';
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
  RAISE NOTICE 'Bây giờ authenticated users có thể tìm kiếm profiles của người khác';
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
  AND tablename = 'profiles'
ORDER BY policyname;

