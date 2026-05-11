"use client";

import { CATEGORIES } from "@/lib/categories";

interface CategoryBarProps {
  selected?: string;
  onSelect?: (category: string) => void;
}

export default function CategoryBar({ selected = "all", onSelect }: CategoryBarProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {CATEGORIES.map(({ label, icon: Icon, slug }) => {
        const isSelected = selected === slug;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onSelect?.(slug)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              isSelected
                ? "bg-brand-500/10 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700"
            }`}
          >
            <Icon size={16} />
            <span className="text-sm font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
