"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import {
  GraduationCap, Search, ChevronDown, X, Menu,
  Store, Package, Heart, MessageCircle, Settings, User,
  LogOut, Home, BarChart2, Zap, ShoppingCart,
  UtensilsCrossed, Shirt, Smartphone, BookOpen,
  Sparkles, Wrench, MoreHorizontal,
} from "lucide-react";

const CATEGORIES = [
  { label: "Food & Groceries", slug: "food",    icon: UtensilsCrossed },
  { label: "Fashion",          slug: "fashion",  icon: Shirt },
  { label: "Tech & Gadgets",   slug: "tech",     icon: Smartphone },
  { label: "Books",            slug: "books",    icon: BookOpen },
  { label: "Beauty",           slug: "beauty",   icon: Sparkles },
  { label: "Services",         slug: "services", icon: Wrench },
  { label: "Other",            slug: "other",    icon: MoreHorizontal },
];

export default function Navbar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { isAuthenticated, user, logout, avatarUrl } = useAuth();

  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [catOpen,     setCatOpen]     = useState(false);
  const [avatarOpen,  setAvatarOpen]  = useState(false);

  const catRef    = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDrawerOpen(false); setCatOpen(false); setAvatarOpen(false); }, [pathname]);

  const closeOnOutside = useCallback((ref: React.RefObject<HTMLElement | null>, cb: () => void) => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { if (catOpen)    return closeOnOutside(catRef,    () => setCatOpen(false));    }, [catOpen,    closeOnOutside]);
  useEffect(() => { if (avatarOpen) return closeOnOutside(avatarRef, () => setAvatarOpen(false)); }, [avatarOpen, closeOnOutside]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      {/* ── Solid top bar ── */}
      <header className="sticky left-0 top-0 w-full z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0">
          <div className="flex items-center h-14 gap-2 md:gap-4">

            {/* ── Logo ── */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                <GraduationCap size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-black text-lg tracking-tight text-gray-900 dark:text-white hidden sm:block">
                Campify
              </span>
            </Link>

            {/* ── Categories dropdown (desktop) ── */}
            <div ref={catRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setCatOpen(!catOpen)}
                className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Menu size={14} />
                All Categories
                <ChevronDown size={13} className={`transition-transform ${catOpen ? "rotate-180" : ""}`} />
              </button>
              {catOpen && (
                <div className="absolute left-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Categories</p>
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <Link
                        key={cat.slug}
                        href={`/search?category=${cat.slug}`}
                        onClick={() => setCatOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Icon size={14} className="text-blue-500" />
                        {cat.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Desktop centre search ── */}
            <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-lg mx-4" suppressHydrationWarning>
              <div className="relative w-full">
                <input
                  name="q"
                  type="search"
                  placeholder="I am shopping for..."
                  autoComplete="off"
                  suppressHydrationWarning
                  className="w-full h-10 pl-4 pr-11 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button type="submit" title="Search" className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center bg-blue-600 rounded-r-lg text-white hover:bg-blue-700 transition-colors">
                  <Search size={16} />
                </button>
              </div>
            </form>

            {/* ── Desktop right ── */}
            <nav className="hidden lg:flex items-center gap-1 ml-auto">
              {isAuthenticated ? (
                <>
                  {/* Bell with live notifications */}
                  <NotificationDropdown />

                  {/* Wishlist */}
                  <Link href="/dashboard/wishlist" className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative" title="Wishlist">
                    <Heart size={20} />
                  </Link>

                  {/* Cart */}
                  <Link href="/dashboard/orders" className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative" title="Orders">
                    <ShoppingCart size={20} />
                  </Link>

                  {/* Avatar dropdown */}
                  <div ref={avatarRef} className="relative ml-1">
                    <button
                      type="button"
                      onClick={() => setAvatarOpen(!avatarOpen)}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-sm shadow-sm overflow-hidden">
                        {avatarUrl
                          ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          : (user?.display_name ?? user?.username ?? "U")[0].toUpperCase()
                        }
                      </div>
                      <ChevronDown size={13} className={`transition-transform duration-200 ${avatarOpen ? "rotate-180" : ""} text-gray-500`} />
                    </button>
                    {avatarOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden">
                            {avatarUrl
                              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                              : (user?.display_name ?? user?.username ?? "U")[0].toUpperCase()
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{user?.display_name ?? user?.username}</p>
                            <p className="text-xs text-gray-400 capitalize">{user?.role ?? "buyer"}</p>
                          </div>
                        </div>
                        <Link href={user?.role === "seller" ? "/seller" : "/dashboard"} onClick={() => setAvatarOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <User size={14} /> My Account
                        </Link>
                        <Link href="/dashboard/orders" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Package size={14} /> Orders
                        </Link>
                        <Link href="/dashboard/wishlist" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Heart size={14} /> Wishlist
                        </Link>
                        {user?.role === "seller" && (
                          <Link href="/seller" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Store size={14} /> Seller Console
                          </Link>
                        )}
                        <Link href="/dashboard/settings" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Settings size={14} /> Settings
                        </Link>
                        <div className="border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
                          <button
                            type="button"
                            onClick={() => { logout(); setAvatarOpen(false); router.push("/signin"); }}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <LogOut size={14} /> Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 ml-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide hidden xl:block">Account</span>
                  <Link href="/signin" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors whitespace-nowrap">
                    Sign In / Register
                  </Link>
                  <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                  <Link href="/dashboard/wishlist" className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors" title="Wishlist">
                    <Heart size={20} />
                  </Link>
                  <Link href="/dashboard/orders" className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors" title="Cart">
                    <ShoppingCart size={20} />
                  </Link>
                </div>
              )}
            </nav>

            {/* ── Mobile right icons ── */}
            <div className="flex lg:hidden items-center gap-1 ml-auto">
              <button
                type="button"
                aria-label="Search"
                onClick={() => router.push("/search")}
                className="p-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Search size={20} />
              </button>
              {isAuthenticated && <NotificationDropdown />}
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
                className="p-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Menu size={22} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-in drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute right-0 top-0 h-full w-[300px] max-w-[90vw] bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-slide-in-right">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                  <GraduationCap size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="font-black text-gray-900 dark:text-white">Campify</span>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {[
                { href: "/",                   label: "Browse Market",     icon: Home },
                { href: "/search",             label: "Search",            icon: Search },
                { href: "/deals",              label: "Flash Sales",       icon: Zap },
                ...(isAuthenticated ? [
                  { href: "/dashboard/orders",   label: "My Orders",         icon: Package },
                  { href: "/dashboard/wishlist", label: "Wishlist",           icon: Heart },
                  { href: "/dashboard/messages", label: "Messages",           icon: MessageCircle },
                  ...(user?.role === "seller" ? [
                    { href: "/seller",           label: "Seller Console",     icon: BarChart2 },
                  ] : []),
                  { href: "/dashboard/settings", label: "Settings",           icon: Settings },
                ] : []),
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href + label}
                  href={href}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-sm transition-colors min-h-[44px]"
                >
                  <Icon size={17} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>

            {/* Drawer footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 space-y-2">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 mb-1">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden">
                      {avatarUrl
                        ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                        : (user?.display_name ?? user?.username ?? "U")[0].toUpperCase()
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{user?.username ?? user?.display_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{user?.role ?? "buyer"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { logout(); setDrawerOpen(false); router.push("/signin"); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-500 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/10 font-medium text-sm transition-colors min-h-[44px]"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all min-h-[44px]"
                  >
                    Sign Up Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
