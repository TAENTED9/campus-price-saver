import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Campify",
  description:
    "Get in touch with the Campify team. Send us a message and we'll respond within 24 hours.",
  alternates: { canonical: "https://campify.digital/contact" },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
