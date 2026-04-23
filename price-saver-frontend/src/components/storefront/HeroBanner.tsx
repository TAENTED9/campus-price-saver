"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, GraduationCap, ShieldCheck, Package, Users, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: "easeOut" as const },
});

export default function HeroBanner() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="relative w-full h-screen max-h-[700px] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center h-full px-4">

        {/* Eyebrow badge */}
        <motion.span
          {...fade(0)}
          className="inline-flex items-center gap-1.5 text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full bg-white/10 border border-white/20 mb-5"
        >
          <GraduationCap size={14} />
          UNILAG&apos;s Campus Marketplace
        </motion.span>

        {/* Title */}
        <motion.h1
          {...fade(0.15)}
          className="text-white font-black text-4xl md:text-6xl lg:text-7xl tracking-tight leading-[1.1] drop-shadow-xl"
        >
          Buy &amp; Sell Smarter
          <br />
          on Campus.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          {...fade(0.25)}
          className="text-white/75 text-base md:text-xl mt-4 max-w-2xl"
        >
          Verified UNILAG sellers &middot; Real-time prices &middot; Safe campus meetups
        </motion.p>

        {/* Inline search bar */}
        <motion.form
          {...fade(0.35)}
          onSubmit={handleSearch}
          className="mt-8 w-full max-w-xl"
        >
          <div className="flex items-center bg-white/95 dark:bg-white backdrop-blur-sm h-14 md:h-16 rounded-2xl shadow-2xl overflow-hidden px-2 gap-2">
            <span className="hidden sm:flex items-center px-3 py-1 bg-gray-100 rounded-xl text-xs font-bold text-gray-600 whitespace-nowrap shrink-0 cursor-default select-none h-10">
              All
            </span>
            <input
              ref={inputRef}
              type="search"
              placeholder="Search products, stores..."
              autoComplete="off"
              className="flex-1 h-full bg-transparent text-gray-900 placeholder-gray-400 text-sm md:text-base outline-none px-2"
            />
            <button
              type="submit"
              className="shrink-0 flex items-center gap-2 bg-blue-600 text-white font-bold px-5 h-10 rounded-xl hover:bg-blue-700 active:scale-95 transition-all text-sm shadow-md shadow-blue-500/30 min-w-[44px] justify-center"
            >
              <Search size={16} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </motion.form>

        {/* CTA row */}
        <motion.div
          {...fade(0.45)}
          className="flex flex-col sm:flex-row gap-3 mt-5"
        >
          <Link
            href="/search"
            className="bg-blue-600 text-white font-bold px-7 py-3 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-900/30 text-sm md:text-base min-h-[44px] flex items-center justify-center"
          >
            Browse Products
          </Link>
          {!isAuthenticated && (
            <Link
              href="/signup?role=seller"
              className="bg-white/15 text-white border border-white/30 font-bold px-7 py-3 rounded-xl hover:bg-white/25 active:scale-95 transition-all text-sm md:text-base min-h-[44px] flex items-center justify-center"
            >
              Start Selling Free
            </Link>
          )}
        </motion.div>

        {/* Trust strip */}
        <motion.div
          {...fade(0.55)}
          className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-6 text-white/60 text-xs"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} /> Verified Sellers
          </span>
          <span className="hidden sm:block w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5">
            <Package size={13} /> 8,000+ Products
          </span>
          <span className="hidden sm:block w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5">
            <Users size={13} /> Free to Use
          </span>
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
