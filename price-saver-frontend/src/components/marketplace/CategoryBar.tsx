"use client";

import { motion } from "framer-motion";
import { CATEGORIES } from "@/lib/categories";

interface CategoryBarProps {
  selected?: string;
  onSelect?: (category: string) => void;
}

export default function CategoryBar({ selected = "all", onSelect }: CategoryBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex gap-3 overflow-x-auto lg:overflow-x-visible lg:justify-center no-scrollbar pb-2"
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
                "transition-all duration-200",
                isSelected
                  ? "ring-2 ring-brand-500 ring-offset-1 bg-brand-50 dark:bg-brand-500/10 scale-105"
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 group-hover:scale-105 group-hover:border-brand-500",
              ].join(" ")}
            >
              <Icon
                size={22}
                className={
                  isSelected
                    ? "text-brand-500 dark:text-brand-400"
                    : "text-gray-500 dark:text-gray-400 group-hover:text-brand-500 dark:group-hover:text-brand-400"
                }
                strokeWidth={1.75}
              />
            </div>

            {/* Label */}
            <span
              className={[
                "text-xs font-semibold transition-colors",
                isSelected
                  ? "text-brand-500 dark:text-brand-400"
                  : "text-gray-600 dark:text-gray-400 group-hover:text-brand-500 dark:group-hover:text-brand-400",
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
