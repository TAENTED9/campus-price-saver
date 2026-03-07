"use client";

import React from "react";

export default function MessagesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Messages</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Chat with sellers about listings</p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-16 text-center">
        <div className="text-5xl mb-4">💬</div>
        <p className="font-bold text-lg text-gray-800 dark:text-white mb-2">No messages yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
          Start a conversation with a seller from any product listing and your chats will appear here.
        </p>
      </div>
    </div>
  );
}
