import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Docs | Campify",
  description:
    "Documentation for Campify sellers - verification, listings, karma points, promotions, and platform rules.",
  alternates: { canonical: "https://campify.digital/seller-docs" },
};

export default function SellerDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
