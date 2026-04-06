"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: "easeOut" },
});

export default function HeroBanner() {
  return (
    <section className="relative w-full h-[480px] md:h-screen md:max-h-[680px] overflow-hidden">
      {/* Background gradient (replace with Cloudinary image when available) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center h-full px-4">
        {/* Eyebrow */}
        <motion.span
          {...fade(0)}
          className="text-white/80 text-xs md:text-sm font-semibold tracking-widest uppercase mb-4 bg-white/10 px-4 py-1.5 rounded-full border border-white/20"
        >
          UNILAG&apos;s #1 Campus Marketplace
        </motion.span>

        {/* Title */}
        <motion.h1
          {...fade(0.15)}
          className="text-white font-black text-4xl md:text-6xl lg:text-7xl tracking-tight leading-tight drop-shadow-xl"
        >
          Smart Shopping
          <br />
          Starts Here.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          {...fade(0.3)}
          className="text-white/80 text-sm md:text-xl mt-4 max-w-2xl"
        >
          100% verified UNILAG sellers &middot; Real-time price tracking &middot; Meet up safely on campus
        </motion.p>

        {/* CTA row */}
        <motion.div
          {...fade(0.45)}
          className="flex flex-col sm:flex-row gap-3 mt-8"
        >
          <Link
            href="/search"
            className="bg-white text-blue-700 font-black px-7 py-3.5 rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-black/20 text-sm md:text-base min-h-[44px] flex items-center justify-center"
          >
            Browse Products &rarr;
          </Link>
          <Link
            href="/signup?role=seller"
            className="bg-white/15 text-white border border-white/30 font-bold px-7 py-3.5 rounded-xl hover:bg-white/25 transition-all text-sm md:text-base min-h-[44px] flex items-center justify-center"
          >
            Start Selling Free
          </Link>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          {...fade(0.6)}
          className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mt-6 text-white/60 text-[11px] md:text-sm font-medium"
        >
          <span>&#10003; 1,200+ Verified Students</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>&#10003; 8,000+ Products Listed</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>&#10003; Free to Use</span>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={24} className="text-white/50" />
        </motion.div>
      </div>
    </section>
  );
}
