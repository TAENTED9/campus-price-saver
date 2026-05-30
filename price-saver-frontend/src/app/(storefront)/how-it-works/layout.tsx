import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works | Campify",
  description:
    "How Campify works for buyers and sellers. Browse listings, message sellers, collect on campus, and earn Karma Points.",
  alternates: { canonical: "https://campify.digital/how-it-works" },
};

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
