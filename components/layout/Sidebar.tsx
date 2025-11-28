"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/providers/auth-provider";
import { BookOpen, GraduationCap, Users, User, PlusCircle } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  
  // Use global auth context - no duplicate API calls!
  const { role } = useAuth();
  const isAdmin = useMemo(() => role === 'admin', [role]);

  const menuItems = [
    {
      section: "HỌC TẬP",
      items: isAdmin
        ? [
            { label: "Khóa học", href: ROUTES.COURSES, icon: <GraduationCap className="w-4 h-4" /> },
            { label: "Thêm khóa học", href: ROUTES.ADMIN, icon: <PlusCircle className="w-4 h-4" /> },
            { label: "Tài khoản", href: ROUTES.PROFILE, icon: <User className="w-4 h-4" /> },
          ]
        : [
            { label: "Khóa học", href: ROUTES.DASHBOARD, icon: <BookOpen className="w-4 h-4" /> },
            { label: "Cộng đồng", href: ROUTES.COMMUNITY, icon: <Users className="w-4 h-4" /> },
            { label: "Hồ sơ học tập", href: ROUTES.STUDY_PROFILE, icon: <GraduationCap className="w-4 h-4" /> },
          ],
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200 shadow-lg
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        transition-transform duration-300 ease-in-out
        h-screen overflow-y-auto
        flex flex-col
        pt-16 md:pt-0
      `}
      >
        {/* Logo */}
        <div className="flex items-center p-4 ">
          <div className="flex items-center gap-3 flex-1">
            <div className=" w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
              <img
                src="/logoptit.jpg"
                alt="Logo MatchingPTIT"
                className="w-full h-full "
              />
            </div>
            <span className="text-xl text-[21px] font-semibold text-[#ca171e]">
              Matching PTIT
            </span>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {menuItems.map((section, idx) => (
            <div key={idx} className={idx > 0 ? "mt-6" : ""}>
              {section.section && (
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                  {section.section}
                </h3>
              )}
              <nav className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <Link
                    key={`${idx}-${itemIdx}-${item.href}`}
                    href={item.href}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${
                        isActive(item.href)
                          ? "bg-red-50 text-primary"
                          : "text-gray-700 hover:bg-gray-100"
                      }
                    `}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
