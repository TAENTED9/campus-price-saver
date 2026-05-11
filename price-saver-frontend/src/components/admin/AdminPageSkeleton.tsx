"use client";

import React from "react";

type AdminPageSkeletonProps = {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  variant?: "table" | "cards" | "list";
};

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className={`h-3 animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${i === 0 ? "w-32" : "flex-1"}`}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 last:border-b-0 dark:border-gray-800"
        >
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
          {Array.from({ length: columns - 1 }).map((_, c) => (
            <div
              key={c}
              className={`h-3 animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${c === 0 ? "w-28" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ rows, columns }: { rows: number; columns: number }) {
  const count = rows * columns;
  return (
    <div className={`grid gap-4 grid-cols-${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div className="mb-3 h-10 w-10 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
          <div className="mb-2 h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-6 w-14 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="h-7 w-20 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

export default function AdminPageSkeleton({
  rows = 6,
  columns = 4,
  showHeader = true,
  variant = "table",
}: AdminPageSkeletonProps) {
  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-9 w-32 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
        </div>
      )}
      {variant === "table"  && <TableSkeleton rows={rows} columns={columns} />}
      {variant === "cards"  && <CardsSkeleton rows={rows} columns={columns} />}
      {variant === "list"   && <ListSkeleton rows={rows} />}
    </div>
  );
}
