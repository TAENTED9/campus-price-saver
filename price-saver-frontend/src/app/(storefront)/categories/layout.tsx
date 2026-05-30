import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse by Category | Campify",
  description:
    "Browse all Campify categories - food, fashion, electronics, books, beauty, services, and more from verified UNILAG students.",
  alternates: { canonical: "https://campify.digital/categories" },
};

export default function CategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
