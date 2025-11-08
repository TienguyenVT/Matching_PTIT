# Hướng dẫn Debug Admin Access Issue

## Vấn đề
Tài khoản `admin@matchingptit.local` có role `admin` nhưng không thể truy cập page `/admin`.

## Các bước thực hiện

### Bước 1: Mở Supabase SQL Editor
1. Đăng nhập vào Supabase Dashboard
2. Chọn project của bạn
3. Vào menu **SQL Editor** (biểu tượng database)

### Bước 2: Chạy các queries
File `DEBUG_ADMIN_ACCESS.sql` chứa 10 queries để kiểm tra.

**Chạy từng query theo thứ tự sau:**

#### QUERY 1: Kiểm tra profile tồn tại
```sql
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    created_at
FROM profiles
WHERE email = 'admin@matchingptit.local';
```

**Kết quả mong đợi:** 1 row với thông tin user
**Báo cáo:** Copy toàn bộ kết quả (bao gồm id)

---

#### QUERY 2: Xem tất cả admin
```sql
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    created_at
FROM profiles
WHERE role = 'admin';
```

**Báo cáo:** Số lượng kết quả và danh sách email

---

#### QUERY 3: Kiểm tra auth.users
```sql
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
```

**Báo cáo:** 
- Có email_confirmed_at không?
- banned_until và deleted_at có NULL không?
- last_sign_in_at gần đây nhất

---

#### QUERY 4: Kiểm tra case-sensitive
```sql
SELECT 
    id,
    email,
    role,
    LOWER(email) as email_lowercase,
    UPPER(email) as email_uppercase
FROM profiles
WHERE LOWER(email) = LOWER('admin@matchingptit.local');
```

**Báo cáo:** Có khớp không?

---

#### QUERY 5: Kiểm tra data type của role
```sql
SELECT 
    id,
    email,
    role,
    pg_typeof(role) as role_data_type,
    LENGTH(role) as role_length,
    role = 'admin' as is_exact_admin_match,
    role::text as role_as_text
FROM profiles
WHERE email = 'admin@matchingptit.local';
```

**Báo cáo quan trọng:**
- `role_data_type`: Phải là text/varchar
- `role_length`: Phải là 5 (length của 'admin')
- `is_exact_admin_match`: Phải là true
- `role_as_text`: Phải là 'admin'

---

#### QUERY 6: Test query như code
**LƯU Ý:** Thay `USER_ID_HERE` bằng `id` từ QUERY 1

```sql
SELECT 
    id, 
    email, 
    full_name, 
    avatar_url, 
    username, 
    role, 
    created_at
FROM profiles
WHERE id = 'USER_ID_HERE'  -- THAY ĐỔI
LIMIT 1;
```

**Báo cáo:** Có trả về đúng user không?

---

#### QUERY 7: Kiểm tra RLS policies
```sql
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
```

**Báo cáo:** Số lượng policies và tên của chúng

---

#### QUERY 8: Tổng quan roles
```sql
SELECT 
    role,
    COUNT(*) as count,
    STRING_AGG(email, ', ') as emails
FROM profiles
GROUP BY role
ORDER BY role;
```

**Báo cáo:** Phân bố roles trong hệ thống

---

#### QUERY 9: Kiểm tra whitespace ẩn
```sql
SELECT 
    id,
    email,
    role,
    LENGTH(role) as role_length,
    LENGTH(TRIM(role)) as trimmed_role_length,
    role = 'admin' as exact_match,
    TRIM(role) = 'admin' as trimmed_match,
    ASCII(SUBSTRING(role, 1, 1)) as first_char_ascii,
    ASCII(SUBSTRING(role, LENGTH(role), 1)) as last_char_ascii
FROM profiles
WHERE email = 'admin@matchingptit.local';
```

**Báo cáo quan trọng:**
- `role_length` vs `trimmed_role_length`: Phải bằng nhau (5)
- `exact_match`: Phải là true
- `first_char_ascii`: Phải là 97 (ký tự 'a')
- `last_char_ascii`: Phải là 110 (ký tự 'n')

---

### Bước 3: Tổng hợp kết quả

Tạo một message với format:

```
QUERY 1:
[kết quả]

QUERY 2:
[kết quả]

QUERY 3:
[kết quả]

...và tiếp tục cho đến QUERY 9
```

### Bước 4: Đợi phân tích

Sau khi nhận được kết quả, tôi sẽ:
1. Phân tích nguyên nhân
2. Đưa ra giải pháp cụ thể
3. Có thể yêu cầu chạy QUERY 10 (UPDATE) nếu cần

---

## Các vấn đề thường gặp

### Vấn đề 1: Role có whitespace
- **Triệu chứng:** `role_length` = 6 thay vì 5
- **Nguyên nhân:** Dữ liệu có space: `'admin '` hoặc `' admin'`
- **Giải pháp:** UPDATE để trim

### Vấn đề 2: Role không đúng case
- **Triệu chứng:** role = `'Admin'` hoặc `'ADMIN'`
- **Nguyên nhân:** Database case-sensitive
- **Giải pháp:** UPDATE về lowercase

### Vấn đề 3: Profile không tồn tại
- **Triệu chứng:** QUERY 1 trả về 0 rows
- **Nguyên nhân:** Profile chưa được tạo
- **Giải pháp:** INSERT profile mới

### Vấn đề 4: RLS Policy chặn
- **Triệu chứng:** Query từ code fail nhưng SQL Editor pass
- **Nguyên nhân:** Row Level Security policy
- **Giải pháp:** Điều chỉnh RLS policy

---

## Lưu ý quan trọng

⚠️ **KHÔNG chạy QUERY 10 (UPDATE) trước khi tôi xác nhận!**

✅ Chạy QUERY 1-9 một cách cẩn thận và copy đầy đủ kết quả

📋 Nếu query nào lỗi, hãy copy cả error message
