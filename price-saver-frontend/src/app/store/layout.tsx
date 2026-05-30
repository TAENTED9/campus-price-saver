import React from "react";
import { ConditionalStorefrontWrapper } from "@/components/layout/ConditionalStorefrontWrapper";

// /store/[username] is a public-facing page. The route lives outside the
// (storefront) route group, so without this layout it would render bare —
// no Navbar, no BottomNav, no Footer. Reuse the same wrapper the rest of
// the storefront uses so the page feels like part of the site.
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <ConditionalStorefrontWrapper>{children}</ConditionalStorefrontWrapper>;
}
