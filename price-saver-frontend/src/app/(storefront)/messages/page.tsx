"use client";

import React, { useEffect } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { useAuth } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { useNotifications } from "@/context/NotificationContext";
import { useRouter } from "next/navigation";

/**
 * Messages page - Full chat interface with message persistence
 * Requires authentication
 */
export default function MessagesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { markCategoryRead } = useNotifications();
  const router = useRouter();

  useEffect(() => { markCategoryRead("messages"); }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ChatProvider>
      <div className="h-[calc(100dvh-56px-70px)] md:h-[calc(100dvh-56px)] overflow-hidden">
        <ChatLayout />
      </div>
    </ChatProvider>
  );
}
