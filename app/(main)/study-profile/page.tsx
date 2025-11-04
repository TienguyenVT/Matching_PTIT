"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import PublicProfileView from "./components/PublicProfileView";
import LearningProgressSection from "./components/LearningProgressSection";
import PrivacyToggle from "./components/PrivacyToggle";

type PublicProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  show_learning_progress?: boolean | null;
};

type EnrolledCourse = {
  courseId: string;
  title: string;
  coverUrl: string | null;
  level: string | null;
  tags: string[] | null;
  enrolledAt: string | null;
  progressPercent: number; // MVP placeholder
};

export default function StudyProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [viewingUserId, setViewingUserId] = useState<string>("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLearningProgress, setShowLearningProgress] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      // Get current authenticated user
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace(ROUTES.LOGIN);
        return;
      }
      setCurrentUserId(user.id);

      // Get userId from query param, default to current user
      const userIdParam = searchParams.get("userId");
      const targetUserId = userIdParam || user.id;
      setViewingUserId(targetUserId);

      const isViewingOwnProfile = targetUserId === user.id;

      // Load profile data (including show_learning_progress)
      // Try to load with show_learning_progress first, fallback if column doesn't exist
      let { data: p, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url, created_at, show_learning_progress")
        .eq("id", targetUserId)
        .single();

      // If column doesn't exist (error code 42703), retry without it
      if (profileError && profileError.code === '42703') {
        console.warn("[StudyProfilePage] Column show_learning_progress does not exist. Please run migration. Falling back...");
        const retryResult = await supabase
          .from("profiles")
          .select("id, username, full_name, email, avatar_url, created_at")
          .eq("id", targetUserId)
          .single();
        p = retryResult.data;
        profileError = retryResult.error;
        // Set default to false since column doesn't exist
        if (p) {
          (p as any).show_learning_progress = false;
        }
      }

      if (profileError || !p) {
        console.error("[StudyProfilePage] Error loading profile:", profileError);
        alert("Không tìm thấy hồ sơ người dùng.");
        router.replace(ROUTES.STUDY_PROFILE);
        return;
      }

      setProfile(p as any);
      setShowLearningProgress((p as any).show_learning_progress || false);

      // Load courses for the target user
      const { data: uc } = await supabase
        .from("user_courses")
        .select("created_at, courses(id, title, cover_url, level, tags)")
        .eq("user_id", targetUserId);

      const normalized: EnrolledCourse[] = (uc || []).map((row: any) => {
        const c = Array.isArray(row.courses) ? row.courses[0] : row.courses;
        return {
          courseId: c?.id || "",
          title: c?.title || "",
          coverUrl: c?.cover_url || null,
          level: c?.level || null,
          tags: (c?.tags as string[] | null) || null,
          enrolledAt: row?.created_at || null,
          // MVP: 0% until per-content tracking exists
          progressPercent: 0,
        };
      });

      setCourses(normalized);
      setLoading(false);
    };
    load();
  }, [supabase, router, searchParams]);

  const handlePrivacyToggleChange = async (newValue: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ show_learning_progress: newValue })
        .eq("id", currentUserId);

      if (error) {
        // Check if column doesn't exist
        if (error.code === '42703') {
          alert("Tính năng này chưa được kích hoạt. Vui lòng chạy migration SQL trong Supabase để thêm cột show_learning_progress.");
          console.error("[StudyProfilePage] Column show_learning_progress does not exist. Please run migration:", error);
          return;
        }
        console.error("[StudyProfilePage] Error updating privacy setting:", error);
        alert("Có lỗi xảy ra khi cập nhật cài đặt. Vui lòng thử lại.");
        return;
      }

      setShowLearningProgress(newValue);
      if (profile) {
        setProfile({ ...profile, show_learning_progress: newValue });
      }
    } catch (error) {
      console.error("[StudyProfilePage] Error updating privacy setting:", error);
      alert("Có lỗi xảy ra khi cập nhật cài đặt. Vui lòng thử lại.");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Đang tải hồ sơ học tập...</p>
      </div>
    );
  }

  const isViewingOwnProfile = currentUserId === viewingUserId;
  const shouldShowProgress = isViewingOwnProfile || showLearningProgress;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">
        {isViewingOwnProfile ? "Hồ sơ học tập" : "Hồ sơ học tập của người dùng khác"}
      </h1>
      
      {/* Section 1: Public profile view */}
      {profile && <PublicProfileView profile={profile} />}

      {/* Privacy toggle - only show for own profile */}
      {/* Note: Toggle will only work after migration is run */}
      {isViewingOwnProfile && profile && 'show_learning_progress' in profile && (
        <PrivacyToggle
          value={showLearningProgress}
          onChange={handlePrivacyToggleChange}
        />
      )}
      {isViewingOwnProfile && profile && !('show_learning_progress' in profile) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Lưu ý:</strong> Để sử dụng tính năng công khai/ẩn tiến độ học tập, vui lòng chạy migration SQL trong Supabase.
            Xem file: <code className="bg-yellow-100 px-1 rounded">supabase/add-show-learning-progress.sql</code>
          </p>
        </div>
      )}

      {/* Section 2: Learning progress */}
      {shouldShowProgress ? (
        <LearningProgressSection courses={courses} isOwner={isViewingOwnProfile} showProgress={true} />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <p className="text-gray-500">Người dùng này đã ẩn tiến độ học tập.</p>
        </div>
      )}
    </div>
  );
}


