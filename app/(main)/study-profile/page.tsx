"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import PublicProfileView from "./components/PublicProfileView";
import LearningProgressSection from "./components/LearningProgressSection";

type PublicProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
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
  const [userId, setUserId] = useState<string>("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace(ROUTES.LOGIN);
        return;
      }
      setUserId(user.id);

      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url, created_at")
        .eq("id", user.id)
        .single();
      setProfile(p as any);

      const { data: uc } = await supabase
        .from("user_courses")
        .select("created_at, courses(id, title, cover_url, level, tags)")
        .eq("user_id", user.id);

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
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Đang tải hồ sơ học tập...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Hồ sơ học tập</h1>
      {/* Section 1: Public profile view */}
      {profile && <PublicProfileView profile={profile} />}

      {/* Section 2: Learning progress */}
      <LearningProgressSection courses={courses} />
    </div>
  );
}


