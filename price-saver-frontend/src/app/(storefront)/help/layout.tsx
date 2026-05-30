import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Centre | Campify",
  description:
    "Answers to common questions about buying, selling, accounts, and staying safe on Campify.",
  alternates: { canonical: "https://campify.digital/help" },
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
