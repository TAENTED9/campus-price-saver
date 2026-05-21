"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface FlashSaleTimerProps {
  endsAt: string;            // ISO datetime string
  onExpire?: () => void;
  className?: string;
}

function getTimeLeft(endsAt: string) {
  const total = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const hours   = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  return { total, hours, minutes, seconds };
}

export function FlashSaleTimer({ endsAt, onExpire, className }: FlashSaleTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endsAt));

  useEffect(() => {
    // Re-sync immediately when endsAt changes (e.g. after a re-fetch).
    setTimeLeft(getTimeLeft(endsAt));

    const interval = setInterval(() => {
      const left = getTimeLeft(endsAt);
      setTimeLeft(left);
      if (left.total <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  if (timeLeft.total <= 0) {
    return (
      <span className={`text-xs text-gray-400 ${className ?? ""}`}>
        Sale ended
      </span>
    );
  }

  const urgent = timeLeft.total < 3_600_000; // under 1 hour

  return (
    <div
      className={[
        "flex items-center gap-1.5 text-xs font-bold",
        urgent
          ? "text-red-500 dark:text-red-400"
          : "text-orange-500 dark:text-orange-400",
        className ?? "",
      ].join(" ")}
      aria-live="polite"
    >
      <Clock size={12} className={urgent ? "animate-pulse" : ""} />
      <span>
        {timeLeft.hours > 0 ? `${timeLeft.hours}h ` : ""}
        {String(timeLeft.minutes).padStart(2, "0")}m{" "}
        {String(timeLeft.seconds).padStart(2, "0")}s
      </span>
    </div>
  );
}

export default FlashSaleTimer;
