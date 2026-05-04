"use client";
import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { adminApi } from "@/lib/api";
import { useState } from "react";
import {
  LayoutDashboard, Users, Store, Package, ShieldAlert, Bell, BarChart3,
  Settings, ShieldCheck, LogOut,
} from "lucide-react";

type FlatNavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
  badgeKey?: "pendingVerifs" | "openReports";
};

const NAV_ITEMS: FlatNavItem[] = [
  { icon: <LayoutDashboard size={20} />, name: "Overview",      path: "/admin" },
  { icon: <Users size={20} />,           name: "All Users",     path: "/admin/users" },
  { icon: <Store size={20} />,           name: "Sellers",       path: "/admin/seller",        badgeKey: "pendingVerifs" },
  { icon: <Package size={20} />,         name: "Listings",      path: "/admin/listings" },
  { icon: <ShieldAlert size={20} />,     name: "Reports",       path: "/admin/reports",       badgeKey: "openReports" },
  { icon: <Bell size={20} />,            name: "Announcements", path: "/admin/announcements" },
  { icon: <BarChart3 size={20} />,       name: "Analytics",     path: "/admin/analytics" },
  { icon: <Settings size={20} />,        name: "Settings",      path: "/admin/settings" },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user, token, logout } = useAdminAuth();
  const pathname = usePathname();

  const [badges, setBadges] = useState({ pendingVerifs: 0, openReports: 0 });

  const fetchBadges = useCallback(async () => {
    if (!token) return;
    try {
      const s = await adminApi.getStats(token);
      setBadges({ pendingVerifs: s.pendingVerifications, openReports: s.openReports });
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchBadges();
    const id = setInterval(fetchBadges, 30_000);
    return () => clearInterval(id);
  }, [fetchBadges]);

  const isActive = useCallback((path: string) => {
    if (path === "/admin") return pathname === "/admin";
    return pathname.startsWith(path);
  }, [pathname]);

  const showLabel = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen z-50 transition-[width,transform] duration-300 ease-in-out
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Brand */}
      <div className={`px-5 py-7 flex items-center ${showLabel ? "justify-start" : "justify-center"}`}>
        <Link href="/admin" className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          {showLabel && (
            <div>
              <span className="block font-black text-[17px] leading-none text-gray-900 dark:text-white tracking-tight">
                Campify
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
                Admin
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all
                    ${active
                      ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                    }`}
                >
                  <span className={`shrink-0 ${active ? "text-brand-500" : ""}`}>
                    {item.icon}
                  </span>
                  {showLabel && (
                    <>
                      <span className="flex-1 text-sm font-medium">{item.name}</span>
                      {badgeCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </>
                  )}
                  {!showLabel && badgeCount > 0 && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom — admin user info + logout */}
      <div className={`border-t border-gray-200 dark:border-gray-800 px-3 py-4 ${showLabel ? "" : "flex justify-center"}`}>
        {showLabel ? (
          <>
            {user && (
              <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-[11px] font-black text-brand-600 dark:text-brand-400">
                  {(user.username || "A").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800 dark:text-white/90">
                    {user.display_name || user.username || "Admin"}
                  </p>
                  <p className="text-[10px] font-medium text-brand-500 uppercase tracking-wide">Administrator</p>
                </div>
              </div>
            )}
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <button
            onClick={logout}
            title="Sign Out"
            aria-label="Sign Out"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
