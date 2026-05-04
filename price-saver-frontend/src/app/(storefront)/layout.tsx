import React from "react";
import { ConditionalStorefrontWrapper } from "@/components/layout/ConditionalStorefrontWrapper";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <ConditionalStorefrontWrapper>{children}</ConditionalStorefrontWrapper>;
}
