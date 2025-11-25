"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";

interface HeaderProps {
  onMenuToggle?: () => void;
}

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type: 'match_request' | 'message' | 'system'; // Add other notification types as needed
};

export function Header({ onMenuToggle }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = supabaseBrowser();
  const router = useRouter();

  // Use global auth context - no duplicate API calls!
  const { user, role, refreshProfile } = useAuth();

  // Memoize computed values
  const isAdmin = useMemo(() => role === 'admin', [role]);
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Lỗi khi đánh dấu đã đọc:', err);
    }
  };
  const homeHref = useMemo(
    () => isAdmin ? ROUTES.COURSES : ROUTES.DASHBOARD,
    [isAdmin]
  );

  // Removed updateRole - now handled by AuthProvider globally

  // Load notifications
  useEffect(() => {
    if (!user) return;

    const loadNotifications = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setNotifications(data || []);
      } catch (err) {
        console.error('Lỗi khi tải thông báo:', err);
        toast.error('Có lỗi xảy ra khi tải thông báo');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);

          if (newNotification.type === 'match_request') {
            toast.success('Bạn có yêu cầu ghép đôi mới!');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Removed - auth state now managed by AuthProvider globally

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(".user-menu-container")) {
        setUserMenuOpen(false);
      }
      if (!target.closest(".notification-menu-container")) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen for profile updates - use global refresh
  useEffect(() => {
    const handleProfileUpdate = () => {
      refreshProfile(); // Use global refresh from AuthProvider
    };

    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("profile-updated", handleProfileUpdate);
  }, [refreshProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace(ROUTES.LOGIN);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="p-2 hover:bg-gray-100 rounded-md"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <Link
          href={homeHref}
          className="p-2 hover:bg-gray-100 rounded-md flex items-center gap-2 text-gray-700 hover:text-teal-600 transition-colors"
          title="Về trang chủ"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="hidden sm:inline text-sm font-medium">
            Trang chủ
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-full text-gray-600 relative"
          onClick={() => router.push(ROUTES.MESSAGES)}
        >
          <span className="sr-only">Tin nhắn</span>
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {/* Unread message indicator */}
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
        </button>

        <div className="relative notification-menu-container">
          <div className="relative">
            <button
              type="button"
              className="p-2 hover:bg-gray-100 rounded-full relative"
              onClick={(e) => {
                e.preventDefault();
                setNotificationOpen(!notificationOpen);
              }}
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">Thông báo mới</h3>
                  <Link
                    href={ROUTES.NOTIFICATIONS}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    onClick={() => setNotificationOpen(false)}
                  >
                    Xem tất cả
                  </Link>
                </div>

                <div className="overflow-y-auto flex-1 max-h-64">
                  {notifications.slice(0, 5).length === 0 ? (
                    <p className="text-sm text-gray-500 px-4 py-8 text-center">
                      Không có thông báo mới
                    </p>
                  ) : (
                    <div className="py-2">
                      {notifications.slice(0, 5).map((notification) => (
                        <Link
                          key={notification.id}
                          href={ROUTES.NOTIFICATIONS}
                          className={`block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 ${!notification.read ? "bg-blue-50" : ""
                            }`}
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!notification.read) {
                              await markAsRead(notification.id);
                            }
                            setNotificationOpen(false);
                            router.push(ROUTES.NOTIFICATIONS);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-0.5">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notification.created_at).toLocaleTimeString(
                                  "vi-VN",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* User Avatar */}
        <div className="relative user-menu-container">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center hover:ring-2 ring-teal-200 transition-all overflow-hidden"
          >
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Nếu ảnh không load được, hiển thị icon mặc định
                  e.currentTarget.style.display = "none";
                  const nextSibling = e.currentTarget
                    .nextSibling as HTMLElement;
                  if (nextSibling) {
                    nextSibling.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <svg
              className={`w-6 h-6 text-teal-600 ${user?.user_metadata?.avatar_url ? "hidden" : ""
                }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  router.push(ROUTES.PROFILE);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Tài khoản
              </button>
              <div className="border-t border-gray-200 my-1"></div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
