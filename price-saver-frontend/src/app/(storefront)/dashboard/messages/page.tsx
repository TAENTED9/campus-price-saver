"use client";

import React, { useEffect } from "react";
import { ChatProvider } from "@/context/ChatContext";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { useNotifications } from "@/context/NotificationContext";

export default function MessagesPage() {
  const { markCategoryRead } = useNotifications();
  useEffect(() => { markCategoryRead("messages"); }, []);

  return (
    <ChatProvider>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden h-[calc(100vh-8rem)]">
        <ChatLayout />
      </div>
    </ChatProvider>
  );
}
