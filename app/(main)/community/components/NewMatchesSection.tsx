"use client";

import { useState } from "react";
import UserCard from "./UserCard";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import type { MatchScore } from "@/lib/utils/matching";

interface NewMatchesSectionProps {
  matches: MatchScore[];
  loading?: boolean;
}

export default function NewMatchesSection({
  matches,
  loading = false,
}: NewMatchesSectionProps) {
  const supabase = supabaseBrowser();
  const { user } = useAuth(); // ✅ Use shared state
  const [matchingUserId, setMatchingUserId] = useState<string | null>(null);

  const handleMatch = async (targetUser: MatchScore["user"], courseId?: string) => {
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
      // Nếu có courseId từ previous match, dùng nó
      // Nếu không, dùng khóa học chung đầu tiên
      let matchingCourseId = courseId;

      if (!matchingCourseId && targetUser.courses && targetUser.courses.length > 0) {
        // Lấy khóa học chung đầu tiên
        if (user) {
          const { data: currentUserCourses } = await supabase
            .from("user_courses")
            .select("course_id")
            .eq("user_id", user.id);

          const currentUserCourseIds = new Set(
            currentUserCourses?.map((uc) => uc.course_id) || []
          );

          const commonCourse = targetUser.courses.find((c) =>
            currentUserCourseIds.has(c.courseId)
          );

          if (commonCourse) {
            matchingCourseId = commonCourse.courseId;
          }
        }
      }

      if (!matchingCourseId) {
        alert("Không tìm thấy khóa học chung để gửi yêu cầu ghép đôi.");
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
        console.error("[NewMatchesSection] Error sending match request:", error);
        alert("Không thể gửi yêu cầu ghép đôi. Vui lòng thử lại.");
        setMatchingUserId(null);
        return;
      }

      alert("Đã gửi yêu cầu ghép đôi. Vui lòng chờ người dùng kia chấp nhận trong mục Thông báo.");
    } catch (error) {
      console.error("[NewMatchesSection] Match error:", error);
      alert("Có lỗi xảy ra. Vui lòng thử lại.");
      setMatchingUserId(null);
    } finally {
      // Reset trạng thái sau khi hoàn tất
      setMatchingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">
          Ghép đôi học tập với người dùng khác
        </h2>
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">
          Ghép đôi học tập với người dùng khác
        </h2>
        <p className="text-gray-500">
          Không tìm thấy người dùng phù hợp để ghép đôi.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">
        Ghép đôi học tập với người dùng khác
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Các người dùng được đề xuất dựa trên khóa học chung, trình độ và tiến
        độ học tập.
      </p>
      <div className="space-y-3">
        {matches.map((match) => (
          <UserCard
            key={match.user.id}
            user={match.user}
            matchScore={match.score}
            commonCourses={match.commonCourses.length}
            showMatchButton={true}
            matching={matchingUserId === match.user.id}
            onMatch={() => handleMatch(match.user)}
          />
        ))}
      </div>
    </div>
  );
}

