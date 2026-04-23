"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UtensilsCrossed, Shirt, Monitor, ChevronRight } from "lucide-react";

// ─── Static fallback slides (used when no admin banners exist) ────────────────

const STATIC_SLIDES = [
  {
    tag: "Campus Essentials",
    title: "Food & Drinks",
    subtitle: "Compare prices across all campus cafeterias, hostels, and vendors in real time.",
    cta: { label: "Explore Food", href: "/categories/food" },
    bg: "from-brand-600 to-brand-800",
    icon: <UtensilsCrossed size={120} className="opacity-90 text-white/40" />,
    image: null as string | null,
  },
  {
    tag: "Student Fashion",
    title: "Fashion & Beauty",
    subtitle: "Discover the best fashion deals from campus vendors and verified student sellers.",
    cta: { label: "Shop Fashion", href: "/categories/fashion" },
    bg: "from-violet-600 to-purple-800",
    icon: <Shirt size={120} className="opacity-90 text-white/40" />,
    image: null as string | null,
  },
  {
    tag: "Tech & Gadgets",
    title: "Electronics",
    subtitle: "Get the best prices on phones, laptops, accessories from trusted campus stores.",
    cta: { label: "Browse Tech", href: "/categories/tech" },
    bg: "from-emerald-600 to-teal-800",
    icon: <Monitor size={120} className="opacity-90 text-white/40" />,
    image: null as string | null,
  },
];

const sideCards = [
  {
    label: "Flash Sales",
    sublabel: "Up to 40% off today",
    href: "/deals",
    bg: "bg-[#D7EBF2]",
    accent: "text-brand-700",
  },
  {
    label: "New Arrivals",
    sublabel: "Just listed on campus",
    href: "/search?sort=newest",
    bg: "bg-[#EAE7DE]",
    accent: "text-amber-700",
  },
];

type BannerAPISlide = {
  id: number;
  title: string;
  message: string;
  banner_url: string | null;
  cta_label: string;
  cta_href: string;
};

type Slide = {
  tag: string;
  title: string;
  subtitle: string;
  cta: { label: string; href: string };
  bg: string;
  icon: React.ReactNode | null;
  image: string | null;
};

// ─── Gradient palette for dynamic banners ─────────────────────────────────────

const GRADIENTS = [
  "from-brand-600 to-brand-800",
  "from-violet-600 to-purple-800",
  "from-emerald-600 to-teal-800",
  "from-orange-600 to-rose-700",
  "from-cyan-600 to-blue-700",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HeroCarousel() {
  const [slides, setSlides] = useState<Slide[]>(STATIC_SLIDES);
  const [active, setActive] = useState(0);

  // Fetch admin-controlled banner slides
  useEffect(() => {
    fetch(`${API_BASE}/api/storefront/banners`)
      .then(r => r.ok ? r.json() : null)
      .then((res: { data: BannerAPISlide[] } | null) => {
        if (!res?.data?.length) return;
        const dynamic: Slide[] = res.data.map((a, i) => ({
          tag: "Featured",
          title: a.title,
          subtitle: a.message,
          cta: { label: a.cta_label, href: a.cta_href },
          bg: GRADIENTS[i % GRADIENTS.length],
          icon: null,
          image: a.banner_url ?? null,
        }));
        setSlides(dynamic);
      })
      .catch(() => {/* keep static fallback */});
  }, []);

  // Auto-advance every 5s
  useEffect(() => {
    const id = setInterval(() => setActive(prev => (prev + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  // Keep active in bounds if slides change
  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [slides.length, active]);

  const slide = slides[active];

  return (
    <div className="flex flex-col xl:flex-row gap-5">
      {/* ── Main slide ── */}
      <div className="xl:w-2/3 w-full">
        <div className="relative rounded-[10px] overflow-hidden min-h-[340px] sm:min-h-[420px]">

          {/* Background — image or gradient */}
          {slide.image ? (
            <>
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
              />
              {/* Dark overlay so text is readable over any image */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-transparent" />
            </>
          ) : (
            <>
              <div className={`absolute inset-0 bg-gradient-to-br ${slide.bg} transition-all duration-700`} />
              <div className="absolute inset-0 opacity-10 dot-pattern" />
            </>
          )}

          {/* Content */}
          <div className="relative z-10 flex items-center justify-between h-full p-8 sm:p-12 min-h-[340px] sm:min-h-[420px]">
            <div className="max-w-[340px]">
              <span className="block font-medium text-sm uppercase text-white/70 mb-4 tracking-wider">
                {slide.tag}
              </span>
              <h1 className="font-bold text-white text-3xl sm:text-[44px] leading-tight mb-3">
                {slide.title}
              </h1>
              <p className="text-sm text-white/80 leading-relaxed mb-8 max-w-[300px] line-clamp-3">
                {slide.subtitle}
              </p>
              <Link
                href={slide.cta.href}
                className="inline-flex font-medium text-white text-sm rounded-full bg-white/20 backdrop-blur-sm border border-white/30 py-3 px-8 ease-out duration-200 hover:bg-white hover:text-gray-900"
              >
                {slide.cta.label}
              </Link>
            </div>

            {/* Decorative icon (only for static slides) */}
            {slide.icon && (
              <div className="hidden sm:block shrink-0 opacity-80">
                {slide.icon}
              </div>
            )}
          </div>

          {/* Pagination dots */}
          {slides.length > 1 && (
            <div className="absolute bottom-5 left-8 sm:left-12 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`transition-all duration-300 rounded-full ${i === active ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60"}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Side cards ── */}
      <div className="xl:w-1/3 w-full flex flex-col justify-between sm:flex-row xl:flex-col gap-5">
        {sideCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group w-full relative rounded-[10px] px-6 py-6 sm:py-7 ${card.bg} flex items-center justify-between gap-4 hover:shadow-md transition-shadow duration-200`}
          >
            <div>
              <h2 className="font-semibold text-gray-800 text-[20px] mb-1 group-hover:text-brand-600 transition-colors">
                {card.label}
              </h2>
              <span className={`text-sm font-medium ${card.accent}`}>
                {card.sublabel}
              </span>
            </div>
            <div className="shrink-0 w-12 h-12 rounded-full bg-white/40 flex items-center justify-center group-hover:bg-white/60 transition-colors">
              <ChevronRight size={20} className="text-gray-700" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
