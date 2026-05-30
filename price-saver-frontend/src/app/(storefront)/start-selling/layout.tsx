import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start Selling | Campify",
  description:
    "Turn your campus hustle into a business. Join hundreds of UNILAG students selling on Campify - zero fees, verified community, on-campus pickup.",
  alternates: { canonical: "https://campify.digital/start-selling" },
};

export default function StartSellingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
