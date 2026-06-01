"use client";

import React, { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ChatProvider } from "@/context/ChatContext";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { useNotifications } from "@/context/NotificationContext";

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageContent />
    </Suspense>
  );
}

function MessagesPageContent() {
  const { markCategoryRead } = useNotifications();
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get("conv") ? Number(searchParams.get("conv")) : undefined;

  useEffect(() => { markCategoryRead("messages"); }, []);

  return (
    <ChatProvider>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden h-[calc(100dvh-8rem-70px)] md:h-[calc(100dvh-8rem)]">
        <ChatLayout initialConversationId={initialConvId} />
      </div>
    </ChatProvider>
  );
}
