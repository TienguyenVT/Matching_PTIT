"use client";

import { Suspense, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/providers/auth-provider";
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

function StudyProfileContent() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, error: authError } = useAuth(); // ✅ Use shared state
  const [viewingUserId, setViewingUserId] = useState<string>("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLearningProgress, setShowLearningProgress] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      console.log("[StudyProfilePage] load() start", {
        authLoading,
        hasUser: !!user,
        userId: user?.id,
      });

      if (authLoading) {
        console.log("[StudyProfilePage] Auth still loading, skip fetch");
        return;
      }

      if (!user) {
        console.warn("[StudyProfilePage] No authenticated user, redirecting to login");
        setErrorMessage("Bạn cần đăng nhập để xem hồ sơ học tập.");
        router.replace(ROUTES.LOGIN);
        return;
      }

      const userIdParam = searchParams.get("userId");
      const targetUserId = userIdParam || user.id;

      setLoading(true);
      setErrorMessage(null);

      try {
        if (cancelled) return;

        setViewingUserId(targetUserId);

        const isViewingOwnProfile = targetUserId === user.id;

        // Load current user's role to filter access
        const { data: currentUserProfile, error: currentProfileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (currentProfileError) {
          console.error("[StudyProfilePage] Error loading current user role:", currentProfileError);
        }

        const currentUserRole = currentUserProfile?.role || 'user';

        // Load profile data (including show_learning_progress and role)
        // Try to load with show_learning_progress first, fallback if column doesn't exist
        let { data: p, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, full_name, email, avatar_url, created_at, show_learning_progress, role")
          .eq("id", targetUserId)
          .single();

        // If column doesn't exist (error code 42703), retry without it
        if (profileError && (profileError as any).code === '42703') {
          console.warn("[StudyProfilePage] Column show_learning_progress does not exist. Please run migration. Falling back...");
          const retryResult = await supabase
            .from("profiles")
            .select("id, username, full_name, email, avatar_url, created_at, role")
            .eq("id", targetUserId)
            .single();
          profileError = retryResult.error;
          if (retryResult.data) {
            p = { ...retryResult.data, show_learning_progress: false } as any;
          }
        }

        if (profileError || !p) {
          console.error("[StudyProfilePage] Error loading profile:", profileError);
          setErrorMessage("Không tìm thấy hồ sơ người dùng.");
          router.replace(ROUTES.STUDY_PROFILE);
          return;
        }

        // Check if target user has same role (users can't view admin profiles and vice versa)
        const targetUserRole = (p as any).role || 'user';
        if (!isViewingOwnProfile && targetUserRole !== currentUserRole) {
          console.log("[StudyProfilePage] Access denied: different roles", {
            currentUserRole,
            targetUserRole,
          });
          setErrorMessage("Bạn không có quyền xem hồ sơ này.");
          router.replace(ROUTES.STUDY_PROFILE);
          return;
        }

        if (cancelled) return;

        setProfile(p as any);
        setShowLearningProgress((p as any).show_learning_progress || false);

        // Load courses for the target user
        const { data: uc, error: coursesError } = await supabase
          .from("user_courses")
          .select("created_at, courses(id, title, cover_url, level, tags)")
          .eq("user_id", targetUserId);

        if (coursesError) {
          console.error("[StudyProfilePage] Error loading courses:", coursesError);
        }

        const normalized: EnrolledCourse[] = (uc || []).map((row: any) => {
          const c = Array.isArray(row.courses) ? row.courses[0] : row.courses;
          return {
            courseId: c?.id || "",
            title: c?.title || "",
            coverUrl: c?.cover_url || null,
            level: c?.level || null,
            tags: (c?.tags as string[] | null) || null,
            enrolledAt: row?.created_at || null,
            progressPercent: 0,
          };
        });

        if (cancelled) return;

        setCourses(normalized);
      } catch (error) {
        if (cancelled) return;
        console.error("[StudyProfilePage] Unexpected error in load():", error);
        setErrorMessage("Có lỗi xảy ra khi tải hồ sơ học tập. Vui lòng thử lại sau.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          console.log("[StudyProfilePage] load() finished", {
            hasProfile: !!profile,
            coursesCount: courses.length,
            errorMessage,
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      console.log("[StudyProfilePage] cleanup - cancelling pending load() if any");
    };
  }, [authLoading, user, supabase, router, searchParams]);

  const handlePrivacyToggleChange = async (newValue: boolean) => {
    try {
      if (!user) return;
      
      const { error } = await supabase
        .from("profiles")
        .update({ show_learning_progress: newValue })
        .eq("id", user.id);

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

  if (errorMessage) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-2">{errorMessage}</p>
        <p className="text-sm text-gray-500">Nếu lỗi tiếp tục xảy ra, vui lòng tải lại trang hoặc đăng nhập lại.</p>
      </div>
    );
  }

  const isViewingOwnProfile = user?.id === viewingUserId;
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

export default function StudyProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-gray-500">Đang tải hồ sơ...</p>
      </div>
    }>
      <StudyProfileContent />
    </Suspense>
  );
}
