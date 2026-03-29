"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface BannerTextProps {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  alignLeft?: boolean;
}

export default function BannerText({
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  alignLeft = false,
}: BannerTextProps) {
  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center px-6 md:px-10 ${
        alignLeft ? "items-start" : "items-center text-center"
      }`}
    >
      <motion.h1
        className="text-white font-black text-3xl md:text-5xl tracking-tight drop-shadow-lg max-w-2xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        {title}
      </motion.h1>

      {description && (
        <motion.p
          className="text-white/85 text-base md:text-lg mt-3 max-w-xl drop-shadow"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.15 }}
        >
          {description}
        </motion.p>
      )}

      {(ctaLabel || secondaryCtaLabel) && (
        <motion.div
          className="flex flex-wrap gap-3 mt-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
        >
          {ctaLabel && ctaHref && (
            <Link
              href={ctaHref}
              className="bg-white text-blue-700 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-all"
            >
              {ctaLabel}
            </Link>
          )}
          {secondaryCtaLabel && secondaryCtaHref && (
            <Link
              href={secondaryCtaHref}
              className="bg-white/15 text-white border border-white/30 font-semibold px-6 py-3 rounded-xl hover:bg-white/25 transition-all"
            >
              {secondaryCtaLabel}
            </Link>
          )}
        </motion.div>
      )}
    </div>
  );
}
