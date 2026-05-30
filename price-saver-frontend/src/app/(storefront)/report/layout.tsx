import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report a Problem | Campify",
  description:
    "Report a misleading listing or problematic seller. Help us keep Campify safe for everyone.",
  alternates: { canonical: "https://campify.digital/report" },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
