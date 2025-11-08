-- ============================================================
-- FIX RLS INFINITE RECURSION ISSUE
-- ============================================================
-- Vấn đề: Policy "Admins can do everything" gây infinite recursion
-- vì nó query chính bảng profiles để check role
-- ============================================================

-- OPTION 1: DROP policy gây vấn đề (KHUYẾN NGHỊ)
-- Policy này không cần thiết vì đã có policy khác cho phép authenticated users đọc
DROP POLICY IF EXISTS "Admins can do everything" ON profiles;

-- ============================================================

-- OPTION 2: Recreate policy KHÔNG có recursion
-- Sử dụng security definer function để tránh recursion
-- Chỉ chạy nếu cần policy "admin can do everything"

-- Tạo function check admin (runs as owner, không trigger RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policy sử dụng function
CREATE POLICY "Admins can do everything v2"
ON profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================

-- OPTION 3: Simplified policies (KHUYẾN NGHỊ NHẤT)
-- Bỏ policy "Admins can do everything"
-- Sử dụng các policy đơn giản hơn

-- Drop tất cả policies hiện tại
DROP POLICY IF EXISTS "profiles authenticated users can read" ON profiles;
DROP POLICY IF EXISTS "profiles public read" ON profiles;
DROP POLICY IF EXISTS "profiles self select" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON profiles;
DROP POLICY IF EXISTS "profiles self update" ON profiles;
DROP POLICY IF EXISTS "profiles self insert" ON profiles;

-- Tạo lại policies đơn giản, không có recursion
-- 1. Everyone can read profiles (authenticated)
CREATE POLICY "Anyone authenticated can read profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Users can delete their own profile
CREATE POLICY "Users can delete own profile"
ON profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- ============================================================
-- LƯU Ý:
-- - OPTION 1: Nhanh nhất, fix ngay vấn đề
-- - OPTION 2: Giữ admin policy nhưng không recursion
-- - OPTION 3: Clean slate, policies đơn giản nhất
-- 
-- KHUYẾN NGHỊ: Chạy OPTION 3 để có policies sạch sẽ
-- ============================================================

-- ============================================================
-- VERIFY POLICIES SAU KHI FIX
-- ============================================================
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
