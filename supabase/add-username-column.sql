-- =====================================================
-- MIGRATION: THÊM CỘT USERNAME VÀO BẢNG PROFILES
-- =====================================================
-- Mục đích: Thêm cột username để lưu trữ tên đăng nhập của người dùng
-- Ngày: 2025-11-01
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Thêm cột username...';
END $$;

-- =====================================================
-- BƯỚC 1: Thêm cột username vào bảng profiles
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username text;
    RAISE NOTICE '✅ Đã thêm cột username vào bảng profiles';
  ELSE
    RAISE NOTICE 'ℹ️  Cột username đã tồn tại trong bảng profiles';
  END IF;
END $$;

-- =====================================================
-- BƯỚC 2: Thêm unique constraint cho username (nếu chưa có)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    RAISE NOTICE '✅ Đã thêm unique constraint cho username';
  ELSE
    RAISE NOTICE 'ℹ️  Unique constraint cho username đã tồn tại';
  END IF;
END $$;

-- =====================================================
-- BƯỚC 3: Update username cho các user hiện có
-- =====================================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET username = COALESCE(
    username, -- Giữ nguyên nếu đã có
    SPLIT_PART(email, '@', 1) -- Lấy phần trước @ của email
  )
  WHERE username IS NULL OR username = '';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Đã update username cho % users hiện có', updated_count;
END $$;

-- =====================================================
-- BƯỚC 4: Cập nhật function handle_new_user() để tự động set username
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username text;
BEGIN
  -- Lấy username từ metadata hoặc từ email (phần trước @)
  user_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'user_name',
    SPLIT_PART(NEW.email, '@', 1) -- Fallback: lấy phần trước @ của email
  );
  
  INSERT INTO public.profiles (id, email, username, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    user_username,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(profiles.username, EXCLUDED.username);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '✅ Đã cập nhật function handle_new_user() để tự động set username';
END $$;

-- =====================================================
-- BƯỚC 5: Fix existing users trong auth.users chưa có profile
-- =====================================================

DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name)
  SELECT 
    id,
    email,
    COALESCE(
      raw_user_meta_data->>'username',
      raw_user_meta_data->>'user_name',
      SPLIT_PART(email, '@', 1)
    ) as username,
    raw_user_meta_data->>'full_name' as full_name
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(profiles.username, EXCLUDED.username);
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✅ Đã tạo profile cho % users mới', inserted_count;
END $$;

-- =====================================================
-- BƯỚC 6: Tạo index cho username để tối ưu tìm kiếm
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

DO $$
BEGIN
  RAISE NOTICE '✅ Đã tạo index cho username';
END $$;

-- =====================================================
-- HOÀN TẤT MIGRATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE '🎉 HOÀN TẤT MIGRATION USERNAME';
  RAISE NOTICE '================================';
END $$;

-- Kiểm tra kết quả
SELECT 
  '✅ MIGRATION COMPLETED' as status,
  COUNT(*) as total_profiles,
  COUNT(username) as profiles_with_username,
  COUNT(*) - COUNT(username) as profiles_without_username
FROM public.profiles;

