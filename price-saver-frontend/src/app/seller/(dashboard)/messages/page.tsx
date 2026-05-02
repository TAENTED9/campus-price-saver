"use client";

import React from "react";
import { ChatProvider } from "@/context/ChatContext";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SellerMessagesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { markCategoryRead } = useNotifications();
  const router = useRouter();

  useEffect(() => { markCategoryRead("messages"); }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ChatProvider>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden h-[calc(100vh-8rem)]">
        <ChatLayout />
      </div>
    </ChatProvider>
  );
}
