import Image from "next/image";
import React from "react";
import { ShieldCheck } from "lucide-react";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  status?: "online" | "offline" | "busy" | "none";
  verified?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-14 w-14",
  xxl: "h-16 w-16",
};

const textSizeClasses = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
  xxl: "text-xl",
};

const statusSizeClasses = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
  xxl: "h-4 w-4",
};

const badgeSizeClasses = {
  xs: "h-3 w-3 -bottom-0.5 -right-0.5",
  sm: "h-3.5 w-3.5 -bottom-0.5 -right-0.5",
  md: "h-4 w-4 -bottom-0.5 -right-0.5",
  lg: "h-5 w-5 -bottom-0.5 -right-0.5",
  xl: "h-5 w-5 -bottom-0.5 -right-0.5",
  xxl: "h-6 w-6 -bottom-0.5 -right-0.5",
};

const statusColorClasses = {
  online: "bg-success-500",
  offline: "bg-error-400",
  busy: "bg-warning-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = "User",
  name,
  size = "md",
  status = "none",
  verified = false,
  className = "",
}) => {
  const initials = name ? getInitials(name) : alt.charAt(0).toUpperCase();

  return (
    <div className={`relative shrink-0 rounded-full ${sizeClasses[size]} ${className}`}>
      {src ? (
        <Image
          width={0}
          height={0}
          sizes="100vw"
          src={src}
          alt={alt}
          className="object-cover w-full h-full rounded-full"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white font-bold">
          <span className={textSizeClasses[size]}>{initials}</span>
        </div>
      )}

      {/* Verified badge */}
      {verified && (
        <span
          className={`absolute flex items-center justify-center rounded-full bg-brand-500 text-white border-2 border-white dark:border-gray-900 ${badgeSizeClasses[size]}`}
        >
          <ShieldCheck size={size === "xs" || size === "sm" ? 8 : 10} />
        </span>
      )}

      {/* Status indicator */}
      {status !== "none" && !verified && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-[1.5px] border-white dark:border-gray-900 ${statusSizeClasses[size]} ${statusColorClasses[status] || ""}`}
        />
      )}
    </div>
  );
};

export default Avatar;
