import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  calculateMatchScore,
  sortMatchesByScore,
  type MatchingUser,
  type MatchScore,
} from "@/lib/utils/matching";

// Mark route as dynamic (uses cookies for auth)
export const dynamic = 'force-dynamic';

/**
 * GET /api/community-matches
 * Lấy danh sách người dùng đã matching và matching mới
 */
export async function GET(req: NextRequest) {
  try {
    let user;
    let supabase = supabaseServer();
    
    // Ưu tiên: Kiểm tra Bearer token từ Authorization header
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1];
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
      
      if (url && anon) {
        // Tạo client tạm để verify token
        const tempClient = createClient(url, anon);
        const { data: { user: tokenUser }, error: tokenError } = 
          await tempClient.auth.getUser(token);
        if (!tokenError && tokenUser) {
          user = tokenUser;
          // Tạo client mới với token để query (RLS sẽ hoạt động đúng)
          supabase = createClient(url, anon, {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          });
        }
      }
    }
    
    // Fallback: Lấy user từ cookies
    if (!user) {
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      user = cookieUser || undefined;
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Lấy role của current user (hiện tại chỉ dùng cho logging / mở rộng sau này)
    const { data: currentUserProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    const currentUserRole = currentUserProfile?.role || 'user';
    console.log("[community-matches] Current user role:", currentUserRole);

    // 1. Lấy người dùng đã matching (từ chat_rooms với status = 'matched')
    // Lấy tất cả rooms mà current user là thành viên
    const { data: userRooms } = await supabase
      .from("chat_members")
      .select("room_id, chat_rooms(id, course_id, status, created_at)")
      .eq("user_id", user.id);

    // ✅ OPTIMIZED: Batch fetch all data to avoid N+1 queries
    let previousMatches: any[] = [];
    
    if (userRooms && userRooms.length > 0) {
      // Get all matched room IDs
      const matchedRoomIds = userRooms
        .filter((ur: any) => ur.chat_rooms?.status === 'matched')
        .map((ur: any) => ur.chat_rooms.id);
      
      if (matchedRoomIds.length > 0) {
        // Batch fetch all chat members with their profiles in ONE query
        const { data: allMembers } = await supabase
          .from("chat_members")
          .select(`
            room_id,
            user_id,
            profiles!inner (
              id,
              full_name,
              email,
              avatar_url,
              role
            )
          `)
          .in("room_id", matchedRoomIds)
          .neq("user_id", user.id);
        
        // Map the results with room info
        if (allMembers) {
          previousMatches = allMembers.map((member: any) => {
            const room = userRooms.find((ur: any) => ur.chat_rooms?.id === member.room_id)?.chat_rooms as any;
            return {
              ...member.profiles,
              roomId: member.room_id,
              courseId: room?.course_id,
              matchedAt: room?.created_at,
            };
          });
        }
      }
    }

    // Remove duplicates and sort by matchedAt DESC
    const uniqueMatches = previousMatches.filter(
      (match, index, self) =>
        index === self.findIndex((m) => m.id === match.id)
    );
    uniqueMatches.sort(
      (a, b) =>
        new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime()
    );

    // Limit to 5 for previous matches
    const limitedPreviousMatches = uniqueMatches.slice(0, 5);
    const totalPreviousMatchesCount = uniqueMatches.length;

    // 2. Lấy danh sách khóa học của user hiện tại từ bảng user_courses
    console.log("[community-matches] Fetching current user courses for user:", user.id);
    const { data: currentUserCourses, error: currentUserCoursesError } = await supabase
      .from("user_courses")
      .select("course_id, courses(id, level)")
      .eq("user_id", user.id);

    if (currentUserCoursesError) {
      console.error("[community-matches] Error fetching current user courses:", currentUserCoursesError);
    }

    console.log("[community-matches] Current user courses count:", currentUserCourses?.length || 0);

    if (!currentUserCourses || currentUserCourses.length === 0) {
      console.log("[community-matches] No courses found for current user, returning empty matches");
      return NextResponse.json({
        previousMatches: limitedPreviousMatches,
        totalPreviousMatches: totalPreviousMatchesCount,
        newMatches: [],
      });
    }

    const currentUserCourseIds = currentUserCourses.map((uc) => uc.course_id);
    console.log("[community-matches] Current user course IDs:", currentUserCourseIds);
    
    const currentUserCourseData: MatchingUser["courses"] =
      currentUserCourses.map((uc: any) => ({
        courseId: uc.course_id,
        level: uc.courses?.level || null,
      }));

    // Filter out users who already matched with current user
    const matchedUserIds = new Set(
      previousMatches.map((m) => m.id)
    );

    // 3. Lấy danh sách TẤT CẢ người dùng khả dụng (đã đăng ký ít nhất 1 khóa học)
    // Query từ bảng user_courses để kiểm tra course_id trùng lặp giữa các user_id
    // Filter theo role: chỉ lấy user cùng role
    console.log("[community-matches] Fetching all available users from user_courses...");
    const { data: allAvailableUsers, error: allUsersError } = await supabase
      .from("user_courses")
      .select("user_id, course_id, courses(id, level), profiles(id, full_name, email, avatar_url, role)")
      .neq("user_id", user.id);

    if (allUsersError) {
      console.error("[community-matches] Error fetching all available users:", allUsersError);
    }

    console.log("[community-matches] Total user_courses records found:", allAvailableUsers?.length || 0);

    // Filter out users who already matched with current user
    const filteredUsers = (allAvailableUsers || []).filter(
      (au: any) => !matchedUserIds.has(au.user_id)
    );

    // Group by user_id to build user profile with courses
    // Đây là nơi kiểm tra course_id trùng lặp giữa các user_id
    console.log("[community-matches] Grouping users by user_id and building courses list...");
    const userMap = new Map<string, any>();
    const courseIdTracking = new Map<string, Set<string>>(); // Track course_id per user_id for debugging
    const userCourseSet = new Map<string, Set<string>>(); // Track unique course_id per user_id to avoid duplicates
    
    for (const item of filteredUsers) {
      const userId = item.user_id;
      const courseId = item.course_id;
      
      // Handle both array and object cases for profiles
      const profile = Array.isArray(item.profiles)
        ? item.profiles[0]
        : item.profiles;
      
      // Skip nếu profile không tồn tại
      if (!profile) continue;
      
      // Track course_id for each user_id (for debugging)
      if (!courseIdTracking.has(userId)) {
        courseIdTracking.set(userId, new Set());
      }
      courseIdTracking.get(userId)!.add(courseId);
      
      // Track unique course_id per user to avoid duplicates
      if (!userCourseSet.has(userId)) {
        userCourseSet.set(userId, new Set());
      }
      
      // Skip nếu course_id đã được thêm cho user này (tránh duplicate)
      if (userCourseSet.get(userId)!.has(courseId)) {
        continue;
      }
      userCourseSet.get(userId)!.add(courseId);
      
      if (!userMap.has(userId)) {
        // Handle both array and object cases for profiles
        const profile = Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles;
        
        // Skip nếu không có profile (user chưa có trong bảng profiles)
        if (!profile) continue;
        
        userMap.set(userId, {
          id: profile?.id || userId,
          full_name: profile?.full_name || null,
          email: profile?.email || null,
          avatar_url: profile?.avatar_url || null,
          courses: [],
        });
      }
      const userData = userMap.get(userId);
      if (!userData) continue;
      
      // Handle both array and object cases for courses
      const course = Array.isArray(item.courses)
        ? item.courses[0]
        : item.courses;
        
      userData.courses.push({
        courseId: courseId,
        level: course?.level || null,
      });
    }
    
    console.log("[community-matches] Unique users found:", userMap.size);
    console.log("[community-matches] Sample course tracking (first 3 users):");
    let count = 0;
    for (const [userId, courseIds] of courseIdTracking.entries()) {
      if (count >= 3) break;
      const userData = userMap.get(userId);
      const commonCourses = userData ? 
        userData.courses.filter((c: { courseId: string }) => currentUserCourseIds.includes(c.courseId)).map((c: { courseId: string }) => c.courseId) : [];
      console.log(`  User ${userId}: ${Array.from(courseIds).length} courses, ${commonCourses.length} common with current user`);
      count++;
    }

    // 4. Tính điểm matching cho mỗi người dùng
    const currentUser: MatchingUser = {
      id: user.id,
      full_name: user.user_metadata?.full_name || null,
      email: user.email || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      courses: currentUserCourseData,
    };

    // 4. Tính điểm matching cho TẤT CẢ người dùng
    // Hàm calculateMatchScore sẽ gọi findCommonCourses() để kiểm tra course_id trùng lặp
    console.log("[community-matches] Calculating match scores...");
    const matchScores: MatchScore[] = [];
    for (const targetUser of userMap.values()) {
      // findCommonCourses() sẽ so sánh course_id giữa currentUser và targetUser
      const score = calculateMatchScore(currentUser, targetUser);
      console.log(`  User ${targetUser.id}: ${score.commonCourses.length} common courses, score: ${score.score}`);
      
      // Thêm tất cả user, không lọc bỏ (kể cả user không có khóa học chung)
      // Thuật toán matching đã tự động cho điểm thấp cho những user này
      matchScores.push(score);
    }
    
    console.log("[community-matches] Total match scores calculated:", matchScores.length);

    // 5. Sắp xếp theo điểm giảm dần
    // Thứ tự sẽ là:
    // - User có khóa học chung + cùng trình độ + cùng tiến độ (điểm cao nhất)
    // - User có khóa học chung + cùng trình độ (điểm cao)
    // - User có khóa học chung (điểm trung bình)
    // - User không có khóa học chung (điểm thấp nhất, nhưng vẫn hiển thị)
    const sortedMatches = sortMatchesByScore(matchScores);

    // 6. Top 50 matches (tăng từ 20 để hiển thị nhiều user hơn)
    const topMatches = sortedMatches.slice(0, 50);

    return NextResponse.json({
      previousMatches: limitedPreviousMatches,
      totalPreviousMatches: totalPreviousMatchesCount,
      newMatches: topMatches,
    });
  } catch (e: any) {
    console.error("[community-matches] Error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

