"use client";

import React, { useEffect } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { useAuth } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { useRouter } from "next/navigation";

/**
 * Messages page - Full chat interface with message persistence
 * Requires authentication
 */
export default function MessagesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <ChatProvider>
      <div className="h-screen bg-white">
        <ChatLayout />
      </div>
    </ChatProvider>
  );
}
