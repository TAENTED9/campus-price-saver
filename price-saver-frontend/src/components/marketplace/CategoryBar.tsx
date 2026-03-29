"use client";

import { motion } from "framer-motion";
import {
  ShoppingBag,
  Utensils,
  Shirt,
  Smartphone,
  BookOpen,
  Sparkles,
  Wrench,
  Hammer,
  Home,
  type LucideIcon,
} from "lucide-react";

interface CategoryBarProps {
  selected?: string;
  onSelect?: (category: string) => void;
}

interface Category {
  label: string;
  icon: LucideIcon;
  slug: string;
}

const CATEGORIES: Category[] = [
  { label: "All",      icon: ShoppingBag, slug: "all"      },
  { label: "Food",     icon: Utensils,    slug: "food"     },
  { label: "Fashion",  icon: Shirt,       slug: "fashion"  },
  { label: "Tech",     icon: Smartphone,  slug: "tech"     },
  { label: "Books",    icon: BookOpen,    slug: "books"    },
  { label: "Beauty",   icon: Sparkles,    slug: "beauty"   },
  { label: "Services", icon: Wrench,      slug: "services" },
  { label: "Handmade", icon: Hammer,      slug: "handmade" },
  { label: "Hostel",   icon: Home,        slug: "hostel"   },
];

export default function CategoryBar({ selected = "all", onSelect }: CategoryBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
    >
      {CATEGORIES.map(({ label, icon: Icon, slug }) => {
        const isSelected = selected === slug;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onSelect?.(slug)}
            className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
          >
            {/* Icon circle */}
            <div
              className={[
                "w-14 h-14 rounded-full flex items-center justify-center",
                "transition-all duration-200 border-2",
                isSelected
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 scale-105 shadow-md shadow-blue-100 dark:shadow-blue-950/30"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 group-hover:scale-105 group-hover:border-blue-500 group-hover:shadow-md group-hover:shadow-blue-100 dark:group-hover:shadow-blue-950/30",
              ].join(" ")}
            >
              <Icon
                size={22}
                className={
                  isSelected
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                }
                strokeWidth={1.75}
              />
            </div>

            {/* Label */}
            <span
              className={[
                "text-xs font-semibold transition-colors",
                isSelected
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400",
              ].join(" ")}
            >
              {label}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}
