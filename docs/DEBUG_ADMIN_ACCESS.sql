-- ============================================================
-- SQL QUERIES ĐỂ DEBUG ADMIN ACCESS ISSUE
-- Chạy từng query theo thứ tự và báo cáo kết quả
-- ============================================================

-- QUERY 1: Kiểm tra profile của admin@matchingptit.local có tồn tại không
-- Mục đích: Xác định user ID và thông tin cơ bản
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    created_at
FROM profiles
WHERE email = 'admin@matchingptit.local';

-- ============================================================

-- QUERY 2: Kiểm tra tất cả admin accounts trong hệ thống
-- Mục đích: Xem có bao nhiêu admin và thông tin của họ
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    created_at
FROM profiles
WHERE role = 'admin';

-- ============================================================

-- QUERY 3: Kiểm tra auth.users table (xem user có active không)
-- Mục đích: Đảm bảo account chưa bị banned/deleted trong auth
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    last_sign_in_at,
    banned_until,
    deleted_at
FROM auth.users
WHERE email = 'admin@matchingptit.local';

-- ============================================================

-- QUERY 4: Kiểm tra case-sensitive của email
-- Mục đích: Đảm bảo email khớp chính xác
SELECT 
    id,
    email,
    role,
    LOWER(email) as email_lowercase,
    UPPER(email) as email_uppercase
FROM profiles
WHERE LOWER(email) = LOWER('admin@matchingptit.local');

-- ============================================================

-- QUERY 5: Kiểm tra data type của cột role
-- Mục đích: Đảm bảo role là string 'admin' không phải số hay enum
SELECT 
    id,
    email,
    role,
    pg_typeof(role) as role_data_type,
    LENGTH(role::text) as role_length,        -- Đã thêm ::text
    role::text = 'admin' as is_exact_admin_match, -- So sánh an toàn hơn khi ép kiểu
    role::text as role_as_text
FROM profiles
WHERE email = 'admin@matchingptit.local';

-- ============================================================

-- QUERY 6: Test query chính xác như code đang dùng
-- Mục đích: Simulate đúng query mà getUserProfile() đang chạy
-- Thay 'USER_ID_HERE' bằng user ID từ QUERY 1
-- QUERY 6 (PHIÊN BẢN DÙNG EMAIL)
SELECT 
    id, 
    email, 
    full_name, 
    avatar_url, 
    username, 
    role, 
    created_at
FROM profiles
WHERE email = 'admin@matchingptit.local' -- Dùng email thay vì ID để test nhanh
LIMIT 1;

-- ============================================================

-- QUERY 7: Kiểm tra RLS (Row Level Security) policies
-- Mục đích: Đảm bảo không có policy nào block việc đọc profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- ============================================================

-- QUERY 8: Kiểm tra tất cả users và roles
-- Mục đích: Xem tổng quan phân bố roles
SELECT 
    role,
    COUNT(*) as count,
    STRING_AGG(email, ', ') as emails
FROM profiles
GROUP BY role
ORDER BY role;

-- ============================================================

-- QUERY 9: Kiểm tra có whitespace/special characters ẩn trong role không
-- Mục đích: Phát hiện lỗi dữ liệu như 'admin ' (có space) thay vì 'admin'
SELECT 
    id,
    email,
    role,
    LENGTH(role::text) as role_length,               -- Thêm ::text
    LENGTH(TRIM(role::text)) as trimmed_role_length, -- Thêm ::text
    role::text = 'admin' as exact_match,             -- Thêm ::text
    TRIM(role::text) = 'admin' as trimmed_match,     -- Thêm ::text
    ASCII(SUBSTRING(role::text, 1, 1)) as first_char_ascii,                 -- Thêm ::text
    ASCII(SUBSTRING(role::text, LENGTH(role::text), 1)) as last_char_ascii  -- Thêm ::text
FROM profiles
WHERE email = 'admin@matchingptit.local';

-- ============================================================

-- QUERY 10: Update role nếu cần (CHẠY SAU CÙNG - CHỈ KHI CẦN THIẾT)
-- Mục đích: Fix role nếu phát hiện vấn đề
-- UNCOMMENT dòng dưới để chạy:
-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE email = 'admin@matchingptit.local'
-- RETURNING id, email, role;

-- ============================================================
-- HƯỚNG DẪN:
-- 1. Chạy QUERY 1-9 theo thứ tự
-- 2. Copy kết quả của mỗi query
-- 3. Báo cáo lại cho tôi TẤT CẢ kết quả
-- 4. Tôi sẽ phân tích và đưa ra giải pháp
-- 5. QUERY 10 chỉ chạy khi tôi yêu cầu
-- ============================================================
