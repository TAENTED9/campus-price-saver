"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import UserDropdown from "@/components/header/UserDropdown";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import { useSidebar } from "@/context/SidebarContext";
import { useRouter } from "next/navigation";
import React, { useState ,useEffect,useRef} from "react";
import { Menu, X, Search } from "lucide-react";

const AppHeader: React.FC<{ showNotifications?: boolean; notificationScope?: string; showSearch?: boolean; className?: string }> = ({ showNotifications = true, notificationScope, showSearch = true, className }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
    <header className={`lg:hidden sticky top-0 flex w-full h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-[30] ${className ?? ""}`}>
      <div className="flex items-center justify-between w-full px-4">

        {/* Left slot: hamburger + logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? <X size={22} /> : <Menu size={20} />}
          </button>

        </div>

        {/* Center slot: search bar — hidden on mobile, conditionally shown */}
        <div className={showSearch ? "hidden md:flex flex-1 max-w-md mx-4" : "hidden"}>
          <form className="w-full">
            <div className="relative">
              <span className="absolute -translate-y-1/2 left-4 top-1/2 pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search listings, stores..."
                className="h-10 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-11 pr-14 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
              <button title="Press ⌘K to focus search" className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-[7px] py-[4.5px] text-xs text-gray-500 dark:text-gray-400">
                <span>⌘</span><span>K</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right slot: search icon (mobile) + actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {/* Mobile search icon button */}
          {showSearch && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
            >
              <Search size={20} />
            </button>
          )}

          <ThemeToggleButton />
          {showNotifications && <NotificationDropdown scope={notificationScope} />}
          <UserDropdown />
        </div>

      </div>
    </header>
    {showSearch && searchOpen && (
      <div className="fixed inset-0 z-[30] flex flex-col bg-white dark:bg-gray-900 lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <form
            className="flex-1 relative"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                setSearchOpen(false);
                setSearchQuery("");
              }
            }}
          >
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Search size={18} />
            </span>
            <input
              autoFocus
              type="search"
              placeholder="Search listings, stores…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-base pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </form>
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 dark:text-gray-400"
            aria-label="Close search"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default AppHeader;
