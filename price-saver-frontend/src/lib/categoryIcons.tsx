/**
 * Shared category icon + color config.
 * Maps category DB id (1–7 after seed) to a Lucide icon + Tailwind color classes.
 * Seeded order: 1=Food, 2=Drinks, 3=Fashion, 4=Tech, 5=Books, 6=Beauty, 7=Services
 */

import React from "react";
import {
  UtensilsCrossed,
  GlassWater,
  Shirt,
  Smartphone,
  BookOpen,
  Sparkles,
  Wrench,
  Package,
} from "lucide-react";

type IconProps = { size?: number; className?: string; strokeWidth?: number };
type LucideIcon = React.FC<IconProps>;

interface CategoryConfig {
  icon: LucideIcon;
  bg: string;      // Tailwind background
  color: string;   // Tailwind icon color
  label: string;   // Fallback label
}

const CONFIG: Record<number, CategoryConfig> = {
  1: { icon: UtensilsCrossed, bg: "bg-orange-50 dark:bg-orange-900/20",  color: "text-orange-500",  label: "Food & Groceries"     },
  2: { icon: GlassWater,      bg: "bg-sky-50 dark:bg-sky-900/20",        color: "text-sky-500",     label: "Drinks & Beverages"   },
  3: { icon: Shirt,           bg: "bg-pink-50 dark:bg-pink-900/20",      color: "text-pink-500",    label: "Fashion & Clothing"   },
  4: { icon: Smartphone,      bg: "bg-violet-50 dark:bg-violet-900/20",  color: "text-violet-500",  label: "Tech & Gadgets"       },
  5: { icon: BookOpen,        bg: "bg-amber-50 dark:bg-amber-900/20",    color: "text-amber-500",   label: "Books & Stationery"   },
  6: { icon: Sparkles,        bg: "bg-rose-50 dark:bg-rose-900/20",      color: "text-rose-500",    label: "Beauty & Personal Care"},
  7: { icon: Wrench,          bg: "bg-green-50 dark:bg-green-900/20",    color: "text-green-600",   label: "Services & Skills"    },
};

const DEFAULT: CategoryConfig = {
  icon: Package,
  bg: "bg-gray-50 dark:bg-gray-800",
  color: "text-gray-400",
  label: "Other",
};

export function getCategoryConfig(id: number): CategoryConfig {
  return CONFIG[id] ?? DEFAULT;
}

/**
 * Renders a rounded icon container for a category.
 * Usage: <CategoryIcon id={item.category_id} size={20} />
 */
export function CategoryIcon({
  id,
  size = 20,
  containerSize = "w-10 h-10",
}: {
  id: number;
  size?: number;
  containerSize?: string;
}) {
  const { icon: Icon, bg, color } = getCategoryConfig(id);
  return (
    <div className={`${containerSize} rounded-full ${bg} flex items-center justify-center shrink-0`}>
      <Icon size={size} className={color} strokeWidth={1.5} />
    </div>
  );
}
