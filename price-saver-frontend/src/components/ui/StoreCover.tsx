"use client";

import Image from "next/image";
import React from "react";
import { Camera } from "lucide-react";

interface StoreCoverProps {
  src?: string | null;
  alt?: string;
  height?: "sm" | "md" | "lg";
  editable?: boolean;
  onEditClick?: () => void;
  className?: string;
}

const heightClasses = {
  sm: "h-24",
  md: "h-36",
  lg: "h-48",
};

const StoreCover: React.FC<StoreCoverProps> = ({
  src,
  alt = "Store cover",
  height = "md",
  editable = false,
  onEditClick,
  className = "",
}) => {
  return (
    <div className={`relative w-full ${heightClasses[height]} rounded-xl overflow-hidden ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 800px"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-brand-500/20 to-accent-500/20 dark:from-brand-500/10 dark:to-accent-500/10" />
      )}

      {editable && (
        <button
          type="button"
          onClick={onEditClick}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-colors"
        >
          <Camera size={14} />
          Change Cover
        </button>
      )}
    </div>
  );
};

export default StoreCover;
