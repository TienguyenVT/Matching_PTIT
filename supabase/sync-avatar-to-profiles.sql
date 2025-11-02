-- =====================================================
-- MIGRATION: SYNC AVATAR TỪ USER_METADATA VÀO PROFILES TABLE
-- =====================================================
-- Mục đích: Đồng bộ avatar_url từ auth.users.raw_user_meta_data vào profiles.avatar_url
--           để đảm bảo avatar hiển thị đúng trong community page
-- Ngày: 2025-11-01
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Sync avatar từ user_metadata vào profiles...';
END $$;

-- =====================================================
-- BƯỚC 1: Cập nhật trigger handle_new_user() để copy avatar_url
-- =====================================================

-- Cập nhật function để copy avatar_url khi tạo user mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '✅ Đã cập nhật function handle_new_user() để copy avatar_url';
END $$;

-- =====================================================
-- BƯỚC 2: Sync avatar của các user hiện có từ metadata vào profiles
-- =====================================================

-- Cập nhật avatar_url trong profiles từ raw_user_meta_data của auth.users
UPDATE public.profiles p
SET avatar_url = COALESCE(
  (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = p.id),
  p.avatar_url
)
WHERE EXISTS (
  SELECT 1 FROM auth.users u 
  WHERE u.id = p.id 
  AND u.raw_user_meta_data->>'avatar_url' IS NOT NULL
);

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Đã sync avatar cho % users hiện có', updated_count;
END $$;

-- =====================================================
-- BƯỚC 3: Cập nhật full_name nếu chưa có trong profiles
-- =====================================================

-- Cập nhật full_name trong profiles từ raw_user_meta_data nếu chưa có
UPDATE public.profiles p
SET full_name = COALESCE(
  p.full_name,
  (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p.id)
)
WHERE p.full_name IS NULL
AND EXISTS (
  SELECT 1 FROM auth.users u 
  WHERE u.id = p.id 
  AND u.raw_user_meta_data->>'full_name' IS NOT NULL
);

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Đã sync full_name cho % users chưa có', updated_count;
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
  RAISE NOTICE 'Avatar và full_name đã được sync từ user_metadata vào profiles';
  RAISE NOTICE 'Trigger handle_new_user() đã được cập nhật để tự động sync avatar cho user mới';
END $$;

-- Kiểm tra kết quả
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.avatar_url as profile_avatar,
  u.raw_user_meta_data->>'avatar_url' as metadata_avatar,
  CASE 
    WHEN p.avatar_url = u.raw_user_meta_data->>'avatar_url' THEN '✅ Synced'
    WHEN p.avatar_url IS NULL AND u.raw_user_meta_data->>'avatar_url' IS NULL THEN '✅ Both NULL'
    ELSE '⚠️ Mismatch'
  END as sync_status
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC
LIMIT 10;

