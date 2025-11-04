"use client";

import UserCard from "./UserCard";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface PreviousMatch {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roomId: string;
  courseId: string;
  matchedAt: string;
}

interface PreviousMatchesSectionProps {
  matches: PreviousMatch[];
  totalCount: number;
  loading?: boolean;
}

export default function PreviousMatchesSection({
  matches,
  totalCount,
  loading = false,
}: PreviousMatchesSectionProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-5 bg-red-500 rounded flex-shrink-0"></div>
          <h1 className="text-xl font-semibold text-gray-800">Người dùng đã ghép đôi</h1>
        </div>
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-5 bg-red-500 rounded flex-shrink-0"></div>
          <h1 className="text-xl font-semibold text-gray-800">Người dùng đã ghép đôi</h1>
        </div>

        <p className="text-gray-500">Bạn chưa có người học cùng nào.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-5 bg-red-500 rounded flex-shrink-0"></div>
        <h1 className="text-xl font-semibold text-gray-800">Người dùng đã ghép đôi</h1>
      </div>
      <div className="space-y-3">
        {matches.map((match) => (
          <UserCard key={match.id} user={match} />
        ))}
      </div>
      {totalCount > matches.length && (
        <div className="mt-4 pt-4 border-t">
          <Link
            href={`${ROUTES.COMMUNITY}?view=all-matches`}
            className="block text-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 transition-colors"
          >
            Xem thêm ({totalCount - matches.length} người dùng khác)
          </Link>
        </div>
      )}
    </div>
  );
}

