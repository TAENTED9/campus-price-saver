"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { sellerApi } from "@/lib/api";
import { useNotifications } from "@/context/NotificationContext";
import Avatar from "@/components/ui/avatar/Avatar";
import {
  LayoutDashboard,
  Package,
  BarChart2,
  MessageCircle,
  Zap,
  Store,
  Settings,
  LogOut,
  ShieldCheck,
  Star,
  Circle,
} from "lucide-react";

type NavItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
};

function buildNavItems(username: string | null | undefined): NavItem[] {
  const storePath = username ? `/store/${username}` : "/seller/profile";
  return [
    { id: "overview",   icon: <LayoutDashboard size={17} />, label: "Overview",      path: "/seller" },
    { id: "listings",   icon: <Package size={17} />,         label: "My Listings",   path: "/seller/listings" },
    { id: "analytics",  icon: <BarChart2 size={17} />,       label: "Analytics",     path: "/seller/analytics" },
    { id: "inbox",      icon: <MessageCircle size={17} />,   label: "Inbox",           path: "/seller/messages" },
    { id: "promotions", icon: <Zap size={17} />,             label: "Promotions",    path: "/seller/promotions" },
    { id: "store",      icon: <Store size={17} />,           label: "My Storefront", path: storePath },
    { id: "settings",   icon: <Settings size={17} />,        label: "Settings",      path: "/seller/settings" },
  ];
}

const STATUS_CYCLE = ["open", "limited", "closed"] as const;
type StoreStatus = (typeof STATUS_CYCLE)[number];

const statusDotColor = (s: StoreStatus) =>
  s === "open" ? "bg-green-500" : s === "limited" ? "bg-yellow-400" : "bg-red-500";
const statusLabel = (s: StoreStatus) =>
  s === "open" ? "Open" : s === "limited" ? "Limited" : "Closed";

const SellerSidebar: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { counts: notifCounts, markCategoryRead } = useNotifications();
  const [inboxUnread, setInboxUnread] = useState(0);
  const [storeStatus, setStoreStatus] = useState<StoreStatus>("open");
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [livePoints, setLivePoints] = useState<number | null>(null);
  const [liveRating, setLiveRating] = useState<number | null>(null);
  const [liveReviewCount, setLiveReviewCount] = useState<number>(0);

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

  useEffect(() => {
    if (!token) return;
    const fetchStats = () => {
      sellerApi.getStats(token)
        .then((r) => {
          if (!r.success) return;
          if (r.data.availabilityStatus) {
            setStoreStatus(r.data.availabilityStatus as StoreStatus);
          } else if (r.data.vacationMode) {
            setStoreStatus("closed");
          }
          if (typeof r.data.sellerPoints === "number") {
            setLivePoints(r.data.sellerPoints);
          }
          if (typeof r.data.avgRating === "number") {
            setLiveRating(r.data.avgRating);
          }
          if (typeof r.data.reviewCount === "number") {
            setLiveReviewCount(r.data.reviewCount);
          }
        })
        .catch(() => {});
    };
    fetchStats();
    const id = setInterval(fetchStats, 15_000);
    return () => clearInterval(id);
  }, [token]);

  async function cycleStatus() {
    if (!token || togglingStatus) return;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(storeStatus) + 1) % STATUS_CYCLE.length];
    setTogglingStatus(true);
    try {
      await sellerApi.setAvailability(token, next);
      setStoreStatus(next);
    } catch { setStoreStatus(next); /* optimistic even on error */ }
    finally { setTogglingStatus(false); }
  }

  const isActive = (path: string) => {
    if (path === "/seller") return pathname === "/seller";
    return pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    router.replace("/signin");
  };

  const storeName = user?.display_name || user?.username || "My Store";
  const isVerified = user?.role === "seller";
  const karmaPoints = livePoints ?? user?.seller_points ?? 0;
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
              <Avatar
                src={user?.avatar_url ?? null}
                name={storeName}
                size="sm"
                className="rounded-xl flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[13px] text-gray-800 dark:text-white truncate">{storeName}</p>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 bg-brand-500 text-white rounded px-1.5 py-0.5 text-[10px] font-bold">
                    <ShieldCheck size={9} />
                    VERIFIED
                  </span>
                )}
              </div>
              {/* Store status dot */}
              <button
                type="button"
                onClick={cycleStatus}
                disabled={togglingStatus}
                title={`Store: ${statusLabel(storeStatus)} — click to change`}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 hover:opacity-75 transition-opacity disabled:opacity-40"
              >
                <Circle size={10} className={`fill-current ${statusDotColor(storeStatus)} text-transparent`} />
                <span className="text-[9px] text-gray-400 leading-none">{statusLabel(storeStatus)}</span>
              </button>
            </div>
            <div className="flex gap-1.5">
              <div className="flex-1 text-center py-1.5 px-1 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                <Star size={12} className="text-yellow-400 mx-auto" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {liveRating !== null ? `${liveRating} Stars` : liveReviewCount === 0 ? "No reviews" : "— Stars"}
                </p>
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
            {buildNavItems(user?.username).map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={() => {
                    if (item.id === "inbox") markCategoryRead("messages");
                    if (isMobileOpen) toggleMobileSidebar();
                  }}
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
                  {item.id === "inbox" && notifCounts.messages > 0 && (
                    <span className="bg-brand-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                      {notifCounts.messages > 99 ? "99+" : notifCounts.messages}
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
