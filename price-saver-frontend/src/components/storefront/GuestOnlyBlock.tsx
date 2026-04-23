"use client";

import { useAuth } from "@/context/AuthContext";
import React from "react";

export default function GuestOnlyBlock({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || isAuthenticated) return null;
  return <>{children}</>;
}
