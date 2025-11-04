"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
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
  const [previousMatches, setPreviousMatches] = useState<PreviousMatch[]>([]);
  const [totalPreviousMatches, setTotalPreviousMatches] = useState(0);
  const [newMatches, setNewMatches] = useState<MatchScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
  }, [supabase, router]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-8 bg-red-500 rounded flex-shrink-0"></div>
        <h1 className="text-2xl font-semibold text-gray-800">Cộng đồng học tập</h1>
      </div>

      {/* Phần 0: Tìm kiếm người dùng */}
      <SearchUsersSection />

      {/* Phần 1: Người dùng đã ghép đôi */}
      <PreviousMatchesSection
        matches={previousMatches}
        totalCount={totalPreviousMatches}
        loading={loading}
      />

      {/* Phần 2: Matching người dùng mới */}
      <NewMatchesSection matches={newMatches} loading={loading} />
    </div>
  );
}

