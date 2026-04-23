"use client";

import React from "react";
import { ChatProvider } from "@/context/ChatContext";
import { ChatLayout } from "@/components/chat/ChatLayout";

export default function MessagesPage() {
  return (
    <ChatProvider>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden h-[calc(100vh-8rem)]">
        <ChatLayout />
      </div>
    </ChatProvider>
  );
}
