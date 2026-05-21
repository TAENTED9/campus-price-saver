"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/useToast";

interface ShareButtonProps {
  url: string;
  title: string;
  description?: string;
  className?: string;
  iconOnly?: boolean;
}

export function ShareButton({
  url,
  title,
  description,
  className,
  iconOnly = false,
}: ShareButtonProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Mobile / supported browsers: native share sheet.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title,
          text: description || title,
          url,
        });
        return;
      } catch (err) {
        // User cancelled — leave silently. Any other error falls through to clipboard.
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Fallback: copy to clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("Link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy link", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={copied ? "Link copied" : "Share this listing"}
      className={
        className ??
        [
          "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold",
          "text-gray-500 dark:text-gray-400",
          "border border-gray-200 dark:border-gray-700 rounded-xl",
          "hover:bg-gray-50 dark:hover:bg-gray-800 transition-all",
        ].join(" ")
      }
    >
      {copied ? (
        <Check size={13} className="text-green-500" />
      ) : (
        <Share2 size={13} />
      )}
      {!iconOnly && <span>{copied ? "Copied!" : "Share"}</span>}
    </button>
  );
}

export default ShareButton;
