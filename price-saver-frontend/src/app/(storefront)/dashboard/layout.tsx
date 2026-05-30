"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { notificationsApi, userApi } from "@/lib/api";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import {
  ShoppingBag,
  Package,
  Heart,
  MessageCircle,
  Bell,
  Settings,
  LogOut,
  Store,
  Search,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  UserCircle,
  Info,
  X,
} from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import { useTheme } from "@/context/ThemeContext";
import { useRoleGuard } from "@/hooks/useRoleGuard";

// Block 2: wishlist count comes from the server (no localStorage).
// `wl-changed` is dispatched by the listing detail page and wishlist page
// after a successful toggle so the badge refetches immediately.

interface SidebarContentProps {
  avatarUrl: string | null;
  initials: string;
  displayName: string;
  bio?: string;
  navItems: Array<{ href: string; label: string; icon: React.ReactNode; count: number }>;
  pathname: string | null;
  onNavClick: () => void;
  onLogout: () => void;
}

function SidebarContent({
  avatarUrl, initials, displayName, bio, navItems, pathname, onNavClick, onLogout,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-base font-bold flex-shrink-0">
          C
        </div>
        <span className="font-extrabold text-[15px] tracking-tight">
          <span className="text-brand-500">Camp</span>
          <span className="text-gray-800 dark:text-white">ify</span>
        </span>
      </div>

      {/* Profile section — no role tag */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0 overflow-hidden">
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            : initials
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate leading-tight">{displayName}</p>
          {bio && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 leading-tight">{bio}</p>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col px-2 py-4 space-y-0.5 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-500/10 text-brand-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white"
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.count > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-error-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                  {item.count > 99 ? "99+" : item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-error-400 hover:text-error-300 hover:bg-error-500/10 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Strict guard: only role === "buyer" may render this tree. Sellers and
  // admins get bounced to the buyer signin without being logged out.
  const { isVerifying, isAuthorized } = useRoleGuard("buyer");
  const { user, token, logout, avatarUrl } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [wlCount, setWlCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [msgUnread, setMsgUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) { router.push(`/search?q=${encodeURIComponent(q)}`); setSearchQuery(""); setSearchOpen(false); }
  };

  // Poll for unread message notifications — 10s + immediate on tab focus
  useEffect(() => {
    if (!token) return;
    const fetchMsgCount = () => {
      notificationsApi.unreadCount(token, "buyer")
        .then((r) => setMsgUnread(r.unread_count))
        .catch(() => {});
    };
    fetchMsgCount();
    const interval = setInterval(fetchMsgCount, 10000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchMsgCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  // Auth + role redirect handled by useRoleGuard above.

  // Block 2: wishlist count lives server-side. Fetch on mount, refetch
  // whenever the listing pages dispatch `wl-changed`.
  useEffect(() => {
    if (!token) { setWlCount(0); return; }
    let cancelled = false;
    const refresh = () => {
      userApi.getDashboardStats(token)
        .then((s) => { if (!cancelled) setWlCount(s.wishlist_count ?? 0); })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("wl-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("wl-changed", refresh);
    };
  }, [token]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Ctrl+K opens search modal
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "k") {
        ev.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Block rendering while session is restoring OR while a non-buyer is
  // being bounced. Without this, the wrong-role user briefly sees the buyer
  // UI before the redirect lands.
  if (isVerifying || !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const NAV_ITEMS = [
    { href: "/dashboard",          label: "Browse Market", icon: <ShoppingBag size={18} />, count: 0 },
    { href: "/dashboard/orders",   label: "My Orders",     icon: <Package size={18} />,     count: 0 },
    { href: "/dashboard/wishlist", label: "Wishlist",      icon: <Heart size={18} />,       count: wlCount },
    { href: "/dashboard/messages", label: "Messages",      icon: <MessageCircle size={18} />, count: msgUnread },
    { href: "/dashboard/alerts",   label: "Price Alerts",  icon: <Bell size={18} />,        count: 0 },
    { href: "/dashboard/settings", label: "Settings",      icon: <Settings size={18} />,    count: 0 },
  ];

  const initials = (user?.display_name || user?.username || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const displayName = user?.display_name || user?.username || "";

  // karma — re-enable when investors are onboard:
  // const karmaPoints = user?.balance ?? 0;

  const sidebarProps: SidebarContentProps = {
    avatarUrl,
    initials,
    displayName,
    bio: user?.department || "",
    navItems: NAV_ITEMS,
    pathname,
    onNavClick: () => setMobileOpen(false),
    onLogout: () => { logout(); router.replace("/signin"); },
  };

  return (
    <div className="min-h-screen">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[29] bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, slide-in on mobile */}
      <aside
        className={`
          fixed top-0 left-0 z-50 flex flex-col h-screen w-[220px]
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Content area */}
      <div className="lg:ml-[220px] min-h-screen bg-gray-50 dark:bg-gray-950">

        {/* Desktop header */}
        <header className="hidden lg:flex items-center h-14 px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-[20] gap-4">
          {/* Search button — opens modal */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex-1 max-w-md text-sm"
          >
            <Search size={15} />
            <span className="flex-1 text-left">Search listings, stores...</span>
            <kbd className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono hidden sm:block"></kbd>
          </button>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <NotificationDropdown scope="buyer" />
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {avatarUrl
                  ? <img src={avatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="avatar" />
                  : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{initials}</div>
                }
                <span className="text-sm font-medium text-gray-900 dark:text-white hidden xl:block">{displayName}</span>
                {dropdownOpen
                  ? <ChevronUp size={14} className="text-gray-400 hidden xl:block" />
                  : <ChevronDown size={14} className="text-gray-400 hidden xl:block" />
                }
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-[50] overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    {avatarUrl
                      ? <img src={avatarUrl} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="avatar" />
                      : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{initials}</div>
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">Buyer</p>
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/dashboard/settings?tab=profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <UserCircle size={16} className="text-gray-400 flex-shrink-0" />
                      Edit profile
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Settings size={16} className="text-gray-400 flex-shrink-0" />
                      Account settings
                    </Link>
                    <Link
                      href="/help"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Info size={16} className="text-gray-400 flex-shrink-0" />
                      Help
                    </Link>
                    <div className="border-t border-gray-200 dark:border-gray-800 my-1" />
                    <button
                      onClick={() => { setDropdownOpen(false); logout(); router.replace("/signin"); }}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
                    >
                      <LogOut size={16} className="flex-shrink-0" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 flex w-full h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-[30]">
          <div className="flex items-center justify-between w-full px-4">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Search size={18} />
              </button>
              <NotificationDropdown scope="buyer" />
              <button
                type="button"
                aria-label="Toggle theme"
                onClick={toggleTheme}
                className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </div>

      </div>

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[50] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <form className="flex-1 relative" onSubmit={handleSearch}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Search size={18} />
              </span>
              <input
                autoFocus
                type="search"
                placeholder="Search listings, stores…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 text-base pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-gray-900 dark:text-white placeholder:text-gray-400"
              />
            </form>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Floating "Browse Marketplace" CTA */}
      <Link
        href="/"
        className="hidden md:flex fixed bottom-6 right-6 z-[20] items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-lg transition-colors"
      >
        <Store size={16} />
        Browse Marketplace
      </Link>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
