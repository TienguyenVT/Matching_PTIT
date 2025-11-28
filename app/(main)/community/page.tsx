"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/providers/auth-provider";
import PreviousMatchesSection from "./components/PreviousMatchesSection";
import NewMatchesSection from "./components/NewMatchesSection";
import SearchUsersSection from "./components/SearchUsersSection";
import type { MatchScore } from "@/lib/utils/matching";

interface PreviousMatch {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roomId: string;
  courseId: string;
  matchedAt: string;
}

export default function CommunityPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(); // ✅ Use shared state
  const [previousMatches, setPreviousMatches] = useState<PreviousMatch[]>([]);
  const [totalPreviousMatches, setTotalPreviousMatches] = useState(0);
  const [newMatches, setNewMatches] = useState<MatchScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Chờ trạng thái auth khởi tạo xong trước khi quyết định redirect
      if (authLoading) {
        return;
      }

      if (!user) {
        router.replace(ROUTES.LOGIN);
        return;
      }

      setLoading(true);
      try {
        // Get session token để gửi cùng request
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch("/api/community-matches", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token && {
              Authorization: `Bearer ${session.access_token}`,
            }),
          },
          credentials: "include", // Quan trọng: gửi cookies cùng request
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Unauthorized - redirect to login
            router.replace(ROUTES.LOGIN);
            return;
          }
          throw new Error("Failed to load matches");
        }

        const data = await response.json();
        setPreviousMatches(data.previousMatches || []);
        setTotalPreviousMatches(data.totalPreviousMatches || data.previousMatches?.length || 0);
        setNewMatches(data.newMatches || []);
      } catch (error) {
        console.error("[CommunityPage] Error loading matches:", error);
        alert("Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase, router, user, authLoading]);

  return (
    <div className="soft-page p-4 md:p-8">
      <div className="soft-page-inner space-y-6">
        <div className="soft-card px-5 py-4">
          <div className="soft-section-title">
            <div className="soft-section-title-pill" />
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                Cộng đồng học tập
              </h1>
              <p className="mt-1 text-xs md:text-sm text-gray-500">
                Kết nối, ghép đôi và tìm người học phù hợp với mục tiêu của bạn.
              </p>
            </div>
          </div>
        </div>

        {/* Phần 0: Tìm kiếm người dùng */}
        <section className="soft-card soft-card-inset p-4 md:p-6">
          <SearchUsersSection />
        </section>

        {/* Phần 1: Người dùng đã ghép đôi */}
        <section className="soft-card p-4 md:p-6">
          <PreviousMatchesSection
            matches={previousMatches}
            totalCount={totalPreviousMatches}
            loading={loading}
          />
        </section>

        {/* Phần 2: Matching người dùng mới */}
        <section className="soft-card p-4 md:p-6">
          <NewMatchesSection matches={newMatches} loading={loading} />
        </section>
      </div>
    </div>
  );
}
