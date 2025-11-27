-- =====================================================
-- MIGRATION: THÊM CỘT SHOW_LEARNING_PROGRESS VÀO BẢNG PROFILES
-- =====================================================
-- Mục đích: Thêm cột show_learning_progress để người dùng có thể công khai/ẩn tiến độ học tập
-- Ngày: 2025-01-XX
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Thêm cột show_learning_progress...';
END $$;

-- =====================================================
-- BƯỚC 1: Thêm cột show_learning_progress vào bảng profiles
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'show_learning_progress'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN show_learning_progress boolean DEFAULT false;
    RAISE NOTICE '✅ Đã thêm cột show_learning_progress vào bảng profiles';
  ELSE
    RAISE NOTICE 'ℹ️  Cột show_learning_progress đã tồn tại trong bảng profiles';
  END IF;
END $$;

-- =====================================================
-- BƯỚC 2: Cập nhật RLS policies để cho phép authenticated users đọc public profiles
-- =====================================================

-- Drop existing public read policy if exists
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;

-- Create policy to allow authenticated users to read public profile data
-- Users can read id, username, full_name, email, avatar_url, created_at, show_learning_progress
-- of any profile (for viewing other users' profiles)
CREATE POLICY "profiles public read" ON public.profiles
  FOR SELECT 
  USING (auth.role() = 'authenticated');

DO $$
BEGIN
  RAISE NOTICE '✅ Đã cập nhật RLS policy để cho phép authenticated users đọc public profiles';
END $$;

-- =====================================================
-- BƯỚC 3: Update default value for existing users (keep as false for privacy)
-- =====================================================

-- This is already handled by DEFAULT false in the ALTER TABLE statement above
-- No need to update existing rows as false is the desired default

DO $$
BEGIN
  RAISE NOTICE '✅ Migration hoàn tất!';
END $$;

