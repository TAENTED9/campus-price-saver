"use client";
import React, { useEffect, useState } from "react";
import Badge from "../ui/badge/Badge";
import {
  ArrowUpIcon,
  GroupIcon,
  UserCircleIcon,
  BoxIconLine,
  AlertIcon,
} from "@/icons";
import { adminApi, type AdminStats } from "@/lib/adminApi";

export const PlatformMetrics = () => {
  const [stats, setStats] = useState<AdminStats>({
    registeredStudents: 0,
    pendingVerifications: 0,
    activeListings: 0,
    openReports: 0,
    newUsersToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats()
      .then((res) => { if (res.success) setStats(res.data); })
      .catch(() => {/* silently keep zeros on error */})
      .finally(() => setIsLoading(false));
  }, []);

  const fmt = (n: number) =>
    isLoading ? "—" : n.toLocaleString();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6">
      {/* Registered Students */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Registered Students
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {fmt(stats.registeredStudents)}
            </h4>
          </div>
          <Badge color="success">
            <ArrowUpIcon />
            {isLoading ? "..." : `+${stats.newUsersToday} today`}
          </Badge>
        </div>
      </div>

      {/* Pending Verifications */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-warning-50 rounded-xl dark:bg-warning-500/10">
          <UserCircleIcon className="text-warning-500 size-6" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Pending Verifications
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {fmt(stats.pendingVerifications)}
            </h4>
          </div>
          <Badge color="warning">Needs review</Badge>
        </div>
      </div>

      {/* Active Listings */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Active Listings
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {fmt(stats.activeListings)}
            </h4>
          </div>
          <Badge color="success">
            <ArrowUpIcon />
            Live now
          </Badge>
        </div>
      </div>

      {/* Open Reports */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-error-50 rounded-xl dark:bg-error-500/10">
          <AlertIcon className="text-error-500 size-6" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Open Reports
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {fmt(stats.openReports)}
            </h4>
          </div>
          <Badge color="error">Unresolved</Badge>
        </div>
      </div>
    </div>
  );
};
