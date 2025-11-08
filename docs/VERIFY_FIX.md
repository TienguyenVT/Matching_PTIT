# Verify Fix cho Admin Access Issue

## Vấn đề đã phát hiện

**Root Cause:** Cột `role` trong database là **ENUM type `user_role`** thay vì `text/varchar`.

Khi Supabase client trả về data, `role` có thể không phải là string thuần, dẫn đến comparison `profile?.role === 'admin'` fail.

## Fix đã áp dụng

✅ **File:** `lib/auth-helpers.client.ts`

✅ **Thay đổi:** Thêm cast `String(data.role)` sau khi query

```typescript
// Cast role to string nếu nó là enum type
if (data && data.role) {
  data.role = String(data.role);
}
```

## Cách test

### Test 1: Đăng nhập và truy cập /admin

1. **Đăng xuất** (nếu đang đăng nhập)
2. **Clear cache** browser (Ctrl + Shift + Delete)
3. **Restart dev server:**
   ```bash
   npm run dev
   ```
4. **Đăng nhập** với `admin@matchingptit.local`
5. **Truy cập:** `http://localhost:3000/admin`

**Kết quả mong đợi:** ✅ Vào được trang admin thành công

---

### Test 2: Kiểm tra console logs

Mở **DevTools → Console** và xem logs:

**Khi vào /admin thành công:**
```
[auth-helpers] Admin access granted
```

**Nếu vẫn bị chặn:**
```
[auth-helpers] User is not admin, access denied
```

---

### Test 3: Verify với user thường

1. **Đăng xuất**
2. **Đăng nhập** với user account (vd: `tiencuber4@gmail.com`)
3. **Truy cập:** `http://localhost:3000/admin`

**Kết quả mong đợi:** ❌ Bị redirect về `/home`

---

## Nếu vẫn chưa work

### Debug steps:

1. **Kiểm tra browser console** xem có logs gì
2. **Mở Network tab** → Filter XHR → Xem request/response
3. **Chạy test query trong SQL Editor:**

```sql
-- Test getUserProfile logic
SELECT 
    id,
    email,
    role,
    role::text as role_as_string,
    role::text = 'admin' as should_be_admin
FROM profiles
WHERE id = '03a3f0eb-5e27-47f9-9363-5c90aa070aa8';
```

4. **Test JavaScript comparison:**

Mở browser console và run:
```javascript
const roleEnum = 'admin'; // Giả sử từ enum
const roleString = String(roleEnum);
console.log('Direct comparison:', roleEnum === 'admin');
console.log('String comparison:', roleString === 'admin');
console.log('Type:', typeof roleEnum, typeof roleString);
```

---

## Alternative Solution: Convert ENUM to TEXT

Nếu fix trên không work, có thể convert column sang TEXT:

### ⚠️ BACKUP DATABASE TRƯỚC!

```sql
-- Step 1: Add new column
ALTER TABLE profiles 
ADD COLUMN role_text TEXT;

-- Step 2: Copy data
UPDATE profiles 
SET role_text = role::text;

-- Step 3: Drop old column (NGUY HIỂM - backup trước!)
-- ALTER TABLE profiles DROP COLUMN role;

-- Step 4: Rename new column
-- ALTER TABLE profiles RENAME COLUMN role_text TO role;
```

**LƯU Ý:** Chỉ làm này nếu fix đầu tiên KHÔNG work!

---

## Monitoring

Sau khi test thành công, monitor trong vài ngày để đảm bảo:

- ✅ Admin vào được `/admin`
- ✅ User bị chặn khỏi `/admin`
- ✅ API admin routes work bình thường
- ✅ Không có error trong console

---

## Báo cáo kết quả

Sau khi test, báo cáo:

1. ✅/❌ Admin có vào được /admin không?
2. ✅/❌ User có bị chặn không?
3. 📝 Console logs hiển thị gì?
4. 📝 Có error nào trong Network tab không?

---

## Contact

Nếu vẫn gặp vấn đề, cung cấp:
- Screenshot console logs
- Screenshot Network tab (XHR requests)
- Kết quả test query SQL
