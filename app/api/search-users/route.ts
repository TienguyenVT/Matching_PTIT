import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Mark route as dynamic (uses cookies for auth)
export const dynamic = 'force-dynamic';

/**
 * GET /api/search-users?q=searchTerm
 * Tìm kiếm người dùng theo username, full_name hoặc email trong bảng profiles
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

    // Lấy role của current user để filter kết quả
    const { data: currentUserProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    const currentUserRole = currentUserProfile?.role || 'user';
    console.log("[search-users] Current user role:", currentUserRole);

    // Lấy query parameter
    const searchParams = req.nextUrl.searchParams;
    const searchTerm = searchParams.get("q")?.trim();

    if (!searchTerm || searchTerm.length < 2) {
      return NextResponse.json({
        users: [],
        message: "Vui lòng nhập ít nhất 2 ký tự để tìm kiếm",
      });
    }

    // Tìm kiếm trong bảng profiles theo username, full_name hoặc email
    // Ưu tiên tìm theo username trước, sau đó đến full_name và email
    // Sử dụng ilike để tìm kiếm không phân biệt hoa thường
    // Lưu ý: username có thể là NULL, nên dùng COALESCE hoặc điều kiện OR
    console.log("[search-users] Searching for:", searchTerm);
    console.log("[search-users] User ID:", user.id);
    
    // Xây dựng query với điều kiện OR để tìm kiếm trên cả 3 trường
    // Xử lý trường hợp username có thể là NULL
    // Filter theo role: user chỉ thấy user, admin chỉ thấy admin
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, avatar_url, role")
      .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .eq("role", currentUserRole) // Chỉ hiển thị user cùng role
      .neq("id", user.id) // Loại bỏ chính user hiện tại
      .limit(20); // Giới hạn 20 kết quả

    if (error) {
      console.error("[search-users] Database error:", error);
      console.error("[search-users] Error details:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { 
          error: "Lỗi khi tìm kiếm người dùng",
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log("[search-users] Found profiles:", profiles?.length || 0);

    // Lấy thông tin khóa học của tất cả users một lần để tối ưu
    const userIds = profiles?.map((p) => p.id) || [];
    let usersWithCourses = profiles || [];
    
    console.log("[search-users] User IDs to fetch courses for:", userIds);
    
    if (userIds.length > 0) {
      console.log("[search-users] Fetching user_courses from database...");
      const { data: allUserCourses, error: coursesError } = await supabase
        .from("user_courses")
        .select("user_id, course_id, courses(id, level)")
        .in("user_id", userIds);

      if (coursesError) {
        console.error("[search-users] Error fetching user_courses:", coursesError);
        console.error("[search-users] Error details:", JSON.stringify(coursesError, null, 2));
        // Vẫn tiếp tục, chỉ là không có courses
      }

      console.log("[search-users] user_courses records found:", allUserCourses?.length || 0);
      if (allUserCourses && allUserCourses.length > 0) {
        console.log("[search-users] Sample user_courses (first 3):", allUserCourses.slice(0, 3));
      }

      // Group courses by user_id (đảm bảo không duplicate course_id cho mỗi user)
      const coursesByUserId = new Map<string, Array<{ courseId: string; level: string | null }>>();
      const userCourseIdSet = new Map<string, Set<string>>(); // Track unique course_id per user
      
      (allUserCourses || []).forEach((uc: any) => {
        const userId = uc.user_id;
        const courseId = uc.course_id;
        
        // Initialize Set nếu chưa có
        if (!userCourseIdSet.has(userId)) {
          userCourseIdSet.set(userId, new Set());
        }
        
        // Skip nếu course_id đã được thêm cho user này (tránh duplicate)
        if (userCourseIdSet.get(userId)!.has(courseId)) {
          return;
        }
        userCourseIdSet.get(userId)!.add(courseId);
        
        if (!coursesByUserId.has(userId)) {
          coursesByUserId.set(userId, []);
        }
        
        // Handle both array and object cases for courses
        const course = Array.isArray(uc.courses)
          ? uc.courses[0]
          : uc.courses;
          
        coursesByUserId.get(userId)!.push({
          courseId: courseId,
          level: course?.level || null,
        });
      });

      // Map profiles với courses của họ
      usersWithCourses = (profiles || []).map((profile) => {
        const userCourses = coursesByUserId.get(profile.id) || [];
        console.log(`[search-users] User ${profile.id}: ${userCourses.length} courses`);
        return {
          ...profile,
          courses: userCourses,
        };
      });
    } else {
      console.log("[search-users] No userIds to fetch courses for");
    }

    return NextResponse.json({
      users: usersWithCourses,
      count: usersWithCourses.length,
    });
  } catch (e: any) {
    console.error("[search-users] Error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

