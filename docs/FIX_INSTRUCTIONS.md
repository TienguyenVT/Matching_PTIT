# Fix RLS Infinite Recursion - Hướng dẫn

## 🐛 Vấn đề

RLS Policy **"Admins can do everything"** gây infinite recursion:

```
Error: infinite recursion detected in policy for relation "profiles"
Code: 42P17
```

### Tại sao?

Policy check admin bằng cách:
```sql
EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = auth.uid() AND role = 'admin'
)
```

→ Query `profiles` → Trigger policy → Query `profiles` lại → **Infinite loop!**

---

## ✅ Giải pháp

Có 3 options, **khuyến nghị OPTION 3**.

---

## 🎯 OPTION 1: Drop policy gây vấn đề (NHANH NHẤT)

### Bước 1: Mở Supabase SQL Editor

### Bước 2: Chạy query này

```sql
DROP POLICY IF EXISTS "Admins can do everything" ON profiles;
```

### Bước 3: Verify

```sql
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'profiles';
```

**Kết quả mong đợi:** Không còn policy "Admins can do everything"

### Bước 4: Test

- Refresh browser
- Đăng nhập với `admin@matchingptit.local`
- Truy cập `/admin`

✅ **Ưu điểm:** Fix nhanh, đơn giản
⚠️ **Nhược điểm:** Không có special permissions cho admin

---

## 🛠️ OPTION 2: Recreate với function (TRUNG BÌNH)

### Bước 1: Tạo security definer function

```sql
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
```

### Bước 2: Drop old policy

```sql
DROP POLICY IF EXISTS "Admins can do everything" ON profiles;
```

### Bước 3: Create new policy

```sql
CREATE POLICY "Admins can do everything v2"
ON profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
```

### Bước 4: Verify & Test

```sql
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
```

✅ **Ưu điểm:** Giữ admin permissions
⚠️ **Nhược điểm:** Phức tạp hơn, cần maintain function

---

## 🌟 OPTION 3: Clean slate - Policies đơn giản (KHUYẾN NGHỊ)

### Bước 1: Drop TẤT CẢ policies cũ

```sql
DROP POLICY IF EXISTS "profiles authenticated users can read" ON profiles;
DROP POLICY IF EXISTS "profiles public read" ON profiles;
DROP POLICY IF EXISTS "profiles self select" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON profiles;
DROP POLICY IF EXISTS "profiles self update" ON profiles;
DROP POLICY IF EXISTS "profiles self insert" ON profiles;
```

### Bước 2: Tạo lại policies đơn giản

```sql
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
```

### Bước 3: Verify

```sql
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

**Kết quả mong đợi:** 4 policies mới:
- Anyone authenticated can read profiles
- Users can insert own profile
- Users can update own profile
- Users can delete own profile

### Bước 4: Test

1. **Clear browser cache** (Ctrl + Shift + Delete)
2. **Restart dev server** (npm run dev)
3. **Đăng nhập** với `admin@matchingptit.local`
4. **Truy cập** `http://localhost:3000/admin`

✅ **Ưu điểm:** 
- Sạch sẽ, dễ hiểu
- Không có recursion
- Dễ maintain

⚠️ **Lưu ý:** 
- Admin không có special DB permissions
- Authorization check thực hiện ở application layer (đã có sẵn trong code)

---

## 🧪 Test sau khi fix

### Test 1: Kiểm tra profiles query work

Trong browser console:
```javascript
const { createClient } = window.supabase;
const supabase = createClient('YOUR_URL', 'YOUR_KEY');
const { data, error } = await supabase.auth.getUser();
console.log('Current user:', data.user.id);

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();
  
console.log('Profile:', profile);
console.log('Error:', profileError);
```

**Kết quả mong đợi:** profile object, KHÔNG có error 500

---

### Test 2: Admin access

1. Login với `admin@matchingptit.local`
2. Truy cập `http://localhost:3000/admin`
3. Check console logs

**Kết quả mong đợi:**
```
✅ [auth-helpers] Admin access granted
```

**KHÔNG có:**
```
❌ infinite recursion detected
❌ 500 Internal Server Error
```

---

### Test 3: User blocked

1. Logout
2. Login với user account (vd: `tiencuber4@gmail.com`)
3. Truy cập `http://localhost:3000/admin`

**Kết quả mong đợi:**
- Redirect về `/home`
- Console log: `[auth-helpers] User is not admin, access denied`

---

## 📊 So sánh Options

| Option | Độ khó | Thời gian | Ưu điểm | Nhược điểm |
|--------|--------|-----------|---------|------------|
| 1 | ⭐ | 30s | Nhanh nhất | Mất admin policy |
| 2 | ⭐⭐⭐ | 5min | Giữ admin policy | Phức tạp |
| 3 | ⭐⭐ | 2min | Sạch sẽ, dễ maintain | Mất admin DB perms |

---

## 💡 Khuyến nghị

**Chạy OPTION 3** vì:
- ✅ Fix triệt để vấn đề
- ✅ Policies đơn giản, dễ hiểu
- ✅ Không có recursion risk
- ✅ Authorization vẫn work (ở app layer)

Admin authorization đã được implement ở application layer:
- Client: `requireAdminAccess()` trong `auth-helpers.client.ts`
- Server: `requireAdminAPI()` trong `auth-helpers.server.ts`

→ Không cần special database policies cho admin!

---

## 🆘 Nếu vẫn lỗi

Sau khi chạy fix, nếu vẫn lỗi:

1. **Restart Supabase local instance** (nếu đang dùng local)
2. **Clear ALL browser data**
3. **Restart dev server**
4. **Test với incognito window**
5. **Báo cáo error mới** (nếu có)

---

## 📝 Summary

**Vấn đề:** RLS policy infinite recursion
**Nguyên nhân:** Policy "Admins can do everything" query lại chính bảng profiles
**Giải pháp:** Drop policy hoặc recreate policies đơn giản
**Khuyến nghị:** OPTION 3 - Clean slate

**Hành động:** Copy toàn bộ OPTION 3 queries vào Supabase SQL Editor và chạy!
