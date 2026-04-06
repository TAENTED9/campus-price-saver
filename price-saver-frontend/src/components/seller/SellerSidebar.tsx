"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { sellerApi } from "@/lib/api";
import {
  LayoutGrid,
  Package,
  PieChart,
  MessageCircle,
  Zap,
  Store,
  Settings,
  LogOut,
  ShieldCheck,
  Star,
} from "lucide-react";

type NavItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "overview",   icon: <LayoutGrid size={17} />,      label: "Overview",      path: "/seller" },
  { id: "listings",   icon: <Package size={17} />,         label: "My Listings",   path: "/seller/listings" },
  { id: "analytics",  icon: <PieChart size={17} />,        label: "Analytics",     path: "/seller/analytics" },
  { id: "inbox",      icon: <MessageCircle size={17} />,   label: "Inbox",         path: "/seller/inbox" },
  { id: "promotions", icon: <Zap size={17} />,             label: "Promotions",    path: "/seller/promotions" },
  { id: "store",      icon: <Store size={17} />,           label: "My Storefront", path: "/seller/profile" },
  { id: "settings",   icon: <Settings size={17} />,        label: "Settings",      path: "/seller/settings" },
];

const SellerSidebar: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [inboxUnread, setInboxUnread] = useState(0);

  useEffect(() => {
    if (!token) return;
    const fetchUnread = () => {
      sellerApi.getInquiries(token)
        .then((res) => { if (res.success) setInboxUnread(res.unread_count); })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const isActive = (path: string) => {
    if (path === "/seller") return pathname === "/seller";
    return pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    router.replace("/signin");
  };

  const initials = (user?.display_name || user?.username || "S")
    .charAt(0)
    .toUpperCase();
  const storeName = user?.display_name || user?.username || "My Store";
  const isVerified = user?.role === "seller";
  const karmaPoints = user?.balance ?? 0;
  const karmaMax = 2000;
  const karmaPct = Math.min(Math.round((karmaPoints / karmaMax) * 100), 100);

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 flex flex-col h-screen w-[220px]
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-800
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-16 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white text-base font-bold flex-shrink-0">
            C
          </div>
          <span className="font-extrabold text-[15px] tracking-tight">
            <span className="text-brand-500">Camp</span>
            <span className="text-gray-800 dark:text-white">ify</span>
          </span>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar px-3 py-4 gap-3">

          {/* Seller profile mini card */}
          <div className="rounded-xl p-3 bg-gradient-to-br from-brand-500/10 to-[#06b6d4]/10 border border-brand-200/60 dark:border-brand-800/60 flex-shrink-0">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[13px] text-gray-800 dark:text-white truncate">{storeName}</p>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 bg-brand-500 text-white rounded px-1.5 py-0.5 text-[10px] font-bold">
                    <ShieldCheck size={9} />
                    VERIFIED
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1.5">
              <div className="flex-1 text-center py-1.5 px-1 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                <Star size={12} className="text-yellow-400 mx-auto" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">4.9 Stars</p>
              </div>
              <div className="flex-1 text-center py-1.5 px-1 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                <p className="font-bold text-[12px] text-brand-500">{karmaPoints.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">pts</p>
              </div>
            </div>
          </div>

          {/* Back to Marketplace link */}
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back to Marketplace
          </Link>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={isMobileOpen ? toggleMobileSidebar : undefined}
                  className={`
                    flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                    border-l-[3px]
                    ${active
                      ? "bg-gradient-to-r from-brand-500/12 to-[#06b6d4]/8 border-brand-500 text-brand-500 dark:text-brand-400 font-semibold"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
                    }
                  `}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.id === "inbox" && inboxUnread > 0 && (
                    <span className="bg-brand-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                      {inboxUnread > 99 ? "99+" : inboxUnread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Karma tier widget */}
          <div className="rounded-xl p-3 bg-gradient-to-br from-brand-500/10 to-[#06b6d4]/8 border border-brand-200/50 dark:border-brand-800/50 flex-shrink-0">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Karma Points</p>
            <p className="text-xl font-extrabold text-brand-500">
              {karmaPoints.toLocaleString()}{" "}
              <span className="text-xs text-gray-400 font-normal">pts</span>
            </p>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-[#06b6d4] transition-all duration-700"
                style={{ width: `${karmaPct}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Rising Seller tier: {karmaPct}%</p>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors flex-shrink-0 border-l-[3px] border-transparent"
          >
            <LogOut size={17} />
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default SellerSidebar;
