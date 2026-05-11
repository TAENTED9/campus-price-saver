"use client";
import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAuth } from "@/context/AuthContext";
import { ChevronDown, UserCircle, Settings, Info, LogOut } from "lucide-react";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user: adminUser, logout: adminLogout } = useAdminAuth();
  const { user: sellerUser, logout: sellerLogout, avatarUrl } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Only treat as admin if on /admin/* routes AND admin session exists
  const isAdmin = pathname.startsWith("/admin") && !!adminUser;
  const displayName = isAdmin
    ? (adminUser?.display_name ?? adminUser?.username ?? "Admin")
    : (sellerUser?.display_name ?? sellerUser?.username ?? "User");
  const subtitle = isAdmin
    ? "Administrator"
    : (sellerUser?.role ? sellerUser.role.charAt(0).toUpperCase() + sellerUser.role.slice(1) : "Seller");

  function handleLogout() {
    if (isAdmin) {
      adminLogout();
      router.push("/admin/signin");
    } else {
      sellerLogout();
      router.push("/signin");
    }
  }

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className="flex items-center text-gray-700 dark:text-gray-400 dropdown-toggle"
      >
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11 bg-brand-100 flex items-center justify-center flex-shrink-0">
          {avatarUrl && !isAdmin
            ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            : <span className="text-brand-600 font-semibold text-sm">{displayName.charAt(0).toUpperCase()}</span>
          }
        </span>

        <span className="block mr-1 font-medium text-theme-sm">
          {displayName}
        </span>

        <ChevronDown
          size={18}
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-800 mb-1">
          <span className="overflow-hidden rounded-full h-10 w-10 bg-brand-100 flex items-center justify-center flex-shrink-0">
            {avatarUrl && !isAdmin
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <span className="text-brand-600 font-semibold text-sm">{displayName.charAt(0).toUpperCase()}</span>
            }
          </span>
          <div className="min-w-0">
            <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400 truncate">
              {displayName}
            </span>
            <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </span>
          </div>
        </div>

        <ul className="flex flex-col gap-1 pb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href={isAdmin ? "/admin/profile" : "/seller/settings?tab=business"}
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <UserCircle size={16} className="text-gray-400 flex-shrink-0" />
              Edit profile
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href={isAdmin ? "/admin/settings" : "/seller/settings"}
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <Settings size={16} className="text-gray-400 flex-shrink-0" />
              Account settings
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/support"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <Info size={16} className="text-gray-400 flex-shrink-0" />
              Support
            </DropdownItem>
          </li>
        </ul>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 mt-3 font-medium text-sm text-error-600 dark:text-error-400 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
        >
          <LogOut size={16} className="flex-shrink-0" />
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
