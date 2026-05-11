"use client";

import React from "react";
import Image from "next/image";

type AdminAvatarProps = {
  src?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE_MAP = {
  xs: { container: "h-7 w-7",  text: "text-[10px]" },
  sm: { container: "h-8 w-8",  text: "text-xs" },
  md: { container: "h-10 w-10", text: "text-sm" },
  lg: { container: "h-12 w-12", text: "text-base" },
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTE = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function pickColor(name?: string | null): string {
  if (!name) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function AdminAvatar({ src, name, size = "md", className = "" }: AdminAvatarProps) {
  const { container, text } = SIZE_MAP[size];
  const initials = getInitials(name);
  const color = pickColor(name);

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full ${container} ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={name ?? "User avatar"}
          fill
          sizes="48px"
          className="object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${color} ${text} font-semibold text-white`}>
          {initials}
        </div>
      )}
    </div>
  );
}
