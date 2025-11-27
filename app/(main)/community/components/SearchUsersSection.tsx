"use client";

import { useState, useEffect } from "react";
import UserCard from "./UserCard";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { findCommonCourses, type MatchingUser } from "@/lib/utils/matching";
import { useAuth } from "@/providers/auth-provider";

interface SearchUser {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  courses: Array<{ courseId: string; level: string | null }>;
}

export default function SearchUsersSection() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { user } = useAuth(); // ✅ Use shared state at component level
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [matchingUserId, setMatchingUserId] = useState<string | null>(null);
  const [currentUserCourses, setCurrentUserCourses] = useState<Array<{ courseId: string; level: string | null }>>([]);

  // Load current user courses khi component mount
  useEffect(() => {
    const loadCurrentUserCourses = async () => {
      try {
        if (user) {
          const { data: courses } = await supabase
            .from("user_courses")
            .select("course_id, courses(id, level, is_active)")
            .eq("user_id", user.id)
            .eq("courses.is_active", true);

          if (courses) {
            // Đảm bảo không có duplicate course_id
            const courseIdSet = new Set<string>();
            const formattedCourses = courses
              .filter((uc: any) => {
                const courseId = uc.course_id;
                if (courseIdSet.has(courseId)) {
                  return false; // Skip duplicate
                }
                courseIdSet.add(courseId);
                return true;
              })
              .map((uc: any) => {
                const course = Array.isArray(uc.courses) ? uc.courses[0] : uc.courses;
                return {
                  courseId: uc.course_id,
                  level: course?.level || null,
                };
              });
            setCurrentUserCourses(formattedCourses);
            console.log("[SearchUsersSection] Loaded current user courses:", formattedCourses.length);
          }
        }
      } catch (error) {
        console.error("[SearchUsersSection] Error loading current user courses:", error);
      }
    };

    loadCurrentUserCourses();
  }, [supabase, user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      alert("Vui lòng nhập ít nhất 2 ký tự để tìm kiếm");
      return;
    }

    setSearching(true);
    try {
      // Reload current user courses để đảm bảo dữ liệu mới nhất khi tính common courses
      if (user) {
        const { data: courses } = await supabase
          .from("user_courses")
          .select("course_id, courses(id, level, is_active)")
          .eq("user_id", user.id)
          .eq("courses.is_active", true);

        if (courses) {
          // Đảm bảo không có duplicate course_id
          const courseIdSet = new Set<string>();
          const formattedCourses = courses
            .filter((uc: any) => {
              const courseId = uc.course_id;
              if (courseIdSet.has(courseId)) {
                return false; // Skip duplicate
              }
              courseIdSet.add(courseId);
              return true;
            })
            .map((uc: any) => {
              const course = Array.isArray(uc.courses) ? uc.courses[0] : uc.courses;
              return {
                courseId: uc.course_id,
                level: course?.level || null,
              };
            });
          setCurrentUserCourses(formattedCourses);
          console.log("[SearchUsersSection] Reloaded current user courses:", formattedCourses.length);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `/api/search-users?q=${encodeURIComponent(searchTerm.trim())}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token && {
              Authorization: `Bearer ${session.access_token}`,
            }),
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.replace(ROUTES.LOGIN);
          return;
        }
        throw new Error("Failed to search users");
      }

      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error("[SearchUsersSection] Search error:", error);
      alert("Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleMatch = async (targetUser: SearchUser) => {
    if (!targetUser) return;

    setMatchingUserId(targetUser.id);

    try {
      // Đảm bảo người dùng đã đăng nhập
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        alert("Vui lòng đăng nhập để gửi yêu cầu ghép đôi.");
        setMatchingUserId(null);
        return;
      }

      // Tìm khóa học chung đầu tiên để matching
      let matchingCourseId: string | undefined;

      if (targetUser.courses && targetUser.courses.length > 0) {
        const { data: currentUserCourses } = await supabase
          .from("user_courses")
          .select("course_id")
          .eq("user_id", currentUser.id);

        const currentUserCourseIds = new Set(
          currentUserCourses?.map((uc) => uc.course_id) || []
        );

        const commonCourse = targetUser.courses.find((c) =>
          currentUserCourseIds.has(c.courseId)
        );

        if (commonCourse) {
          matchingCourseId = commonCourse.courseId;
        } else if (targetUser.courses.length > 0) {
          // Nếu không có khóa học chung, dùng khóa học đầu tiên của target user (lưu trong metadata)
          matchingCourseId = targetUser.courses[0].courseId;
        }
      }

      if (!matchingCourseId) {
        alert("Người dùng này chưa đăng ký khóa học nào.");
        setMatchingUserId(null);
        return;
      }

      // Gửi yêu cầu ghép đôi thông qua bảng notifications (flow request/accept)
      const { error } = await supabase
        .from("notifications")
        .insert([
          {
            user_id: targetUser.id,
            title: "Yêu cầu ghép đôi",
            message: `${currentUser.user_metadata?.full_name || "Ai đó"} muốn ghép đôi với bạn`,
            type: "match_request",
            read: false,
            metadata: {
              from_user: currentUser.id,
              course_id: matchingCourseId || null,
            },
          },
        ]);

      if (error) {
        console.error("[SearchUsersSection] Error sending match request:", error);
        alert("Không thể gửi yêu cầu ghép đôi. Vui lòng thử lại.");
        setMatchingUserId(null);
        return;
      }

      alert("Đã gửi yêu cầu ghép đôi. Vui lòng chờ người dùng kia chấp nhận trong mục Thông báo.");
    } catch (error) {
      console.error("[SearchUsersSection] Match error:", error);
      alert("Có lỗi xảy ra. Vui lòng thử lại.");
      setMatchingUserId(null);
    } finally {
      // Reset trạng thái sau khi hoàn tất
      setMatchingUserId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-5 bg-red-500 rounded flex-shrink-0"></div>
        <h1 className="text-xl font-semibold text-gray-800">Tìm kiếm người dùng</h1>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nhập username, tên hoặc email để tìm kiếm..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            disabled={searching}
          />
          <button
            type="submit"
            disabled={searching || !searchTerm.trim()}
            className="px-6 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {searching ? "Đang tìm..." : "Tìm kiếm"}
          </button>
        </div>
      </form>

      {/* Search Results */}
      {searching && (
        <div className="text-center py-8 text-gray-500">
          <p>Đang tìm kiếm...</p>
        </div>
      )}

      {!searching && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Không tìm thấy người dùng nào với từ khóa &quot;{searchTerm}&quot;</p>
        </div>
      )}

      {!searching && searchResults.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-3">
            Tìm thấy {searchResults.length} người dùng
          </p>
          {searchResults.map((user) => {
            // Tính số khóa học chung giữa current user và searched user
            const currentUser: MatchingUser = {
              id: "", // Không cần id để tính common courses
              full_name: null,
              email: null,
              avatar_url: null,
              courses: currentUserCourses,
            };

            const searchedUser: MatchingUser = {
              id: user.id,
              full_name: user.full_name,
              email: user.email,
              avatar_url: user.avatar_url,
              courses: user.courses,
            };

            // Sử dụng hàm findCommonCourses từ matching utils để tính đúng số khóa học chung
            // Hàm này sẽ so sánh course_id giữa currentUser và searchedUser
            const commonCoursesList = findCommonCourses(currentUser, searchedUser);
            const commonCoursesCount = commonCoursesList.length;

            // Debug logging để verify với database
            console.log(`[SearchUsersSection] User ${user.id} (${user.full_name || user.username || user.email}):`, {
              currentUserCoursesCount: currentUserCourses.length,
              currentUserCourseIds: currentUserCourses.map(c => c.courseId),
              searchedUserCoursesCount: user.courses.length,
              searchedUserCourseIds: user.courses.map(c => c.courseId),
              commonCoursesCount: commonCoursesCount,
              commonCourseIds: commonCoursesList,
            });

            return (
              <UserCard
                key={user.id}
                user={user}
                commonCourses={commonCoursesCount}
                showMatchButton={true}
                matching={matchingUserId === user.id}
                onMatch={() => handleMatch(user)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

