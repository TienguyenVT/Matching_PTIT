"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface HeaderProps {
  onMenuToggle?: () => void;
}

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export function Header({ onMenuToggle }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const supabase = supabaseBrowser();
  const router = useRouter();

  useEffect(() => {
    // Load notifications
    const loadNotifications = async () => {
      // Tạm thời mock data, sau này sẽ query từ DB
      const mockNotifications: Notification[] = [
        {
          id: "1",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "3",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "4",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "5",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "6",
          title: "Cộng đồng",
          message: "Bạn được cộng 3000 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "7",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "8",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "9",
          title: "Cộng đồng",
          message: "Bạn được cộng 3000 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "10",
          title: "Cộng đồng",
          message: "Bạn được cộng 500 thóc",
          read: false,
          created_at: new Date().toISOString(),
        },
      ];
      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter((n) => !n.read).length);
    };
    loadNotifications();
  }, []);

  useEffect(() => {
    // Load user data
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    loadUser();

    // Listen for auth state changes (including avatar updates)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    // Đóng menus khi click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".user-menu-container")) {
        setUserMenuOpen(false);
      }
      if (!(e.target as Element).closest(".notification-menu-container")) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Listen for profile updates
    const handleProfileUpdate = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    window.addEventListener("profile-updated", handleProfileUpdate);
    return () =>
      window.removeEventListener("profile-updated", handleProfileUpdate);
  }, [supabase]);

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
          href={ROUTES.DASHBOARD}
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
        {/* Notification Bell */}
        <div className="relative notification-menu-container">
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="p-2 hover:bg-gray-100 rounded-full relative"
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
            <div className="absolute right-0 mt-2 w-80 bg-teal-50 rounded-lg shadow-lg border border-teal-200 py-2 z-50 max-h-96 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-teal-200">
                <h3 className="font-semibold text-gray-800">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="overflow-y-auto flex-1 max-h-64">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 px-4 py-8 text-center">
                    Không có thông báo
                  </p>
                ) : (
                  <div className="py-2">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="px-4 py-3 hover:bg-teal-100 border-b border-teal-100 last:border-0"
                      >
                        <div className="flex items-start gap-3">
                          {!notif.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">
                              {notif.title}
                            </p>
                            <p className="text-sm text-gray-600 mt-0.5">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-teal-200 px-4 py-2">
                <button className="w-full text-center text-sm text-teal-600 hover:text-teal-700 font-medium py-2 border border-teal-300 rounded-md hover:bg-teal-100">
                  Xem tất cả thông báo
                </button>
              </div>
            </div>
          )}
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
              className={`w-6 h-6 text-teal-600 ${
                user?.user_metadata?.avatar_url ? "hidden" : ""
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
