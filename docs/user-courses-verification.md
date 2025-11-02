# Xác minh truy vấn user_courses và kiểm tra course_id trùng lặp

## Tóm tắt

Hệ thống **CÓ** truy vấn đến database Supabase tại bảng `user_courses` để kiểm tra `course_id` trùng lặp giữa các `user_id`.

## Các điểm truy vấn user_courses

### 1. API Route: `/api/community-matches`

**Vị trí:** `app/api/community-matches/route.ts`

**Query 1: Lấy courses của user hiện tại**
```typescript
const { data: currentUserCourses } = await supabase
  .from("user_courses")
  .select("course_id, courses(id, level)")
  .eq("user_id", user.id);
```
- **Mục đích:** Lấy danh sách `course_id` của user đang đăng nhập
- **Dòng code:** 116-119

**Query 2: Lấy TẤT CẢ users khả dụng**
```typescript
const { data: allAvailableUsers } = await supabase
  .from("user_courses")
  .select("user_id, course_id, courses(id, level), profiles(...)")
  .neq("user_id", user.id);
```
- **Mục đích:** Lấy tất cả records từ `user_courses` của các users khác
- **Dòng code:** 153-156
- **Dữ liệu trả về:** Mỗi record chứa `user_id`, `course_id`, và thông tin course

### 2. API Route: `/api/search-users`

**Vị trí:** `app/api/search-users/route.ts`

**Query: Lấy courses của users tìm được**
```typescript
const { data: allUserCourses } = await supabase
  .from("user_courses")
  .select("user_id, course_id, courses(id, level)")
  .in("user_id", userIds);
```
- **Mục đích:** Lấy courses của các users được tìm thấy
- **Dòng code:** 99-102

## Logic kiểm tra course_id trùng lặp

### Bước 1: Group courses theo user_id

**Vị trí:** `app/api/community-matches/route.ts` (dòng 169-214)

```typescript
const userMap = new Map<string, any>();
for (const item of filteredUsers) {
  const userId = item.user_id;
  const courseId = item.course_id;
  
  // Group courses theo user_id
  if (!userMap.has(userId)) {
    userMap.set(userId, { courses: [] });
  }
  userData.courses.push({ courseId: courseId, level: ... });
}
```

**Kết quả:** Mỗi user có một mảng `courses` chứa tất cả `course_id` của họ.

### Bước 2: So sánh course_id giữa các users

**Vị trí:** `lib/utils/matching.ts` - Hàm `findCommonCourses()`

```typescript
export function findCommonCourses(user1: MatchingUser, user2: MatchingUser): string[] {
  // Tạo Set từ course_ids của user1
  const user1CourseIds = new Set(user1.courses.map((c) => c.courseId));
  
  // Filter course_ids của user2 để tìm những course_id có trong Set của user1
  // ĐÂY CHÍNH LÀ LOGIC KIỂM TRA COURSE_ID TRÙNG LẶP
  return user2.courses
    .map((c) => c.courseId)
    .filter((courseId) => user1CourseIds.has(courseId));
}
```

**Cách hoạt động:**
1. Tạo một `Set` từ `course_id` của user1 (để tối ưu tìm kiếm O(1))
2. Duyệt qua `course_id` của user2
3. Filter những `course_id` có trong `Set` của user1
4. Kết quả: Mảng các `course_id` trùng lặp giữa 2 users

### Bước 3: Tính điểm matching dựa trên course_id trùng lặp

**Vị trí:** `lib/utils/matching.ts` - Hàm `calculateMatchScore()`

```typescript
// 1. Tìm khóa học chung (sử dụng findCommonCourses)
const commonCourses = findCommonCourses(currentUser, targetUser);

// 2. Tính điểm dựa trên số course_id trùng lặp
const courseScore = (commonCourses.length / maxCourses) * 50;
```

## Logging đã thêm

Để xác minh hệ thống có thực sự truy vấn database, các logs sau đã được thêm:

1. **Query logging:**
   - `[community-matches] Fetching current user courses for user: {userId}`
   - `[community-matches] Current user courses count: {count}`
   - `[community-matches] Current user course IDs: [ids...]`
   - `[community-matches] Fetching all available users from user_courses...`
   - `[community-matches] Total user_courses records found: {count}`

2. **Grouping logging:**
   - `[community-matches] Grouping users by user_id and building courses list...`
   - `[community-matches] Unique users found: {count}`
   - `[community-matches] Sample course tracking (first 3 users):`

3. **Matching logging:**
   - `[community-matches] Calculating match scores...`
   - `  User {userId}: {commonCount} common courses, score: {score}`
   - `[findCommonCourses] User {id1} vs {id2}: {count} common courses: [ids...]`

## Cách kiểm tra

1. **Kiểm tra console logs:**
   - Mở terminal khi chạy dev server
   - Xem logs khi truy cập `/community`
   - Kiểm tra các dòng log `[community-matches]` và `[findCommonCourses]`

2. **Kiểm tra database trực tiếp:**
   ```sql
   -- Kiểm tra xem có data trong user_courses không
   SELECT user_id, course_id, COUNT(*) 
   FROM public.user_courses 
   GROUP BY user_id, course_id;
   
   -- Kiểm tra course_id trùng lặp giữa 2 users
   SELECT 
     uc1.user_id as user1_id,
     uc2.user_id as user2_id,
     uc1.course_id
   FROM public.user_courses uc1
   INNER JOIN public.user_courses uc2 
     ON uc1.course_id = uc2.course_id 
     AND uc1.user_id != uc2.user_id;
   ```

3. **Kiểm tra Network tab:**
   - Mở DevTools > Network
   - Tìm request đến `/api/community-matches`
   - Xem response và kiểm tra `newMatches` có `commonCourses` không

## Kết luận

✅ **Hệ thống CÓ truy vấn đến bảng `user_courses`**
✅ **Hệ thống CÓ kiểm tra `course_id` trùng lặp giữa các `user_id`**
✅ **Logic được implement trong hàm `findCommonCourses()`**
✅ **Logging đã được thêm để verify**

Nếu không thấy kết quả, kiểm tra:
- RLS policies có cho phép query `user_courses` không
- Có data trong bảng `user_courses` không
- Console logs có hiển thị không

