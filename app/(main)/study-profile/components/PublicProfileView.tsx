"use client";

type PublicProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

export default function PublicProfileView({ profile }: { profile: PublicProfile }) {
  const getAvatar = () => {
    if (profile.avatar_url) {
      return (
        <img
          src={profile.avatar_url}
          alt={profile.full_name || "Avatar"}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const nextSibling = e.currentTarget.nextSibling as HTMLElement;
            if (nextSibling) nextSibling.style.display = "flex";
          }}
        />
      );
    }
    return null;
  };

  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString()
    : "";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-3xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Trang cá nhân</h2>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {getAvatar()}
          {!profile.avatar_url && (
            <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-gray-900 truncate">
            {profile.full_name || profile.username || profile.email?.split("@")[0] || "Người dùng"}
          </h3>
          {profile.username && (
            <p className="text-sm text-gray-500 truncate">@{profile.username}</p>
          )}
          {joined && (
            <p className="text-sm text-gray-500">Tham gia: {joined}</p>
          )}
        </div>
      </div>
    </div>
  );
}


