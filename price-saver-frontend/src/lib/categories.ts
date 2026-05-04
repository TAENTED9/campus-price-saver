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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CategoryDef {
  slug: string;
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: "all",      label: "All",      icon: ShoppingBag },
  { slug: "food",     label: "Food",     icon: Utensils    },
  { slug: "fashion",  label: "Fashion",  icon: Shirt       },
  { slug: "tech",     label: "Tech",     icon: Smartphone  },
  { slug: "books",    label: "Books",    icon: BookOpen    },
  { slug: "beauty",   label: "Beauty",   icon: Sparkles    },
  { slug: "services", label: "Services", icon: Wrench      },
  { slug: "handmade", label: "Handmade", icon: Hammer      },
  { slug: "hostel",   label: "Hostel",   icon: Home        },
];
