"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface UserCardProps {
  user: {
    id: string;
    username?: string | null;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  matchScore?: number;
  commonCourses?: number;
  showMatchButton?: boolean;
  onMatch?: () => void;
  matching?: boolean;
}

export default function UserCard({
  user,
  matchScore,
  commonCourses,
  showMatchButton = false,
  onMatch,
  matching = false,
}: UserCardProps) {
  const getAvatarDisplay = () => {
    if (user.avatar_url) {
      return (
        <img
          src={user.avatar_url}
          alt={user.full_name || "Avatar"}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const nextSibling = e.currentTarget.nextSibling as HTMLElement;
            if (nextSibling) {
              nextSibling.style.display = "flex";
            }
          }}
        />
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {getAvatarDisplay()}
          {!user.avatar_url && (
            <svg
              className="w-8 h-8 text-red-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">
            {user.full_name || user.username || user.email?.split("@")[0] || "Người dùng"}
          </h3>
          {user.username && (
            <p className="text-xs text-gray-500 truncate">
              @{user.username}
            </p>
          )}
          {commonCourses !== undefined && (
            <p className="text-sm text-gray-600">
              {commonCourses} khóa học chung
            </p>
          )}
          {matchScore !== undefined && (
            <p className="text-sm text-primary font-medium">
              Độ tương đồng: {matchScore.toFixed(1)}%
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={ROUTES.STUDY_PROFILE_USER(user.id)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm whitespace-nowrap"
          >
            Xem hồ sơ
          </Link>
          {showMatchButton && onMatch && (
            <button
              onClick={onMatch}
              disabled={matching}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
            >
              {matching ? "Đang ghép..." : "Ghép đôi"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
