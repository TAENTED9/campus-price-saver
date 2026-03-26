"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { Message } from "@/lib/messageApi";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { MessageInput } from "./MessageInput";

interface ChatWindowProps {
  conversation_id: number;
  receiver_id: number;
  receiver_name?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation_id,
  receiver_id,
  receiver_name = "User",
}) => {
  const { user } = useAuth();
  const { messages, isLoadingOlder, loadInitialMessages, loadOlderMessages } =
    useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const topMessageRef = useRef<HTMLDivElement>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  // Load initial messages on mount
  useEffect(() => {
    loadInitialMessages(conversation_id);
  }, [conversation_id, loadInitialMessages]);

  // Setup IntersectionObserver for infinite scroll (loading older messages)
  useEffect(() => {
    // When user scrolls to top and topMessageRef is visible, load older messages
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect();
    }

    intersectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingOlder && messages.length > 0) {
          loadOlderMessages();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "100px", // Start loading when 100px from top
      }
    );

    if (topMessageRef.current) {
      intersectionObserverRef.current.observe(topMessageRef.current);
    }

    return () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
      }
    };
  }, [isLoadingOlder, messages.length, loadOlderMessages]);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleMessageSent = () => {
    // Auto-scroll to bottom when message is sent
    setTimeout(scrollToBottom, 100);
  };

  if (!user) {
    return <div className="flex items-center justify-center h-full">Please log in to message</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">{receiver_name}</h2>
        <p className="text-sm text-gray-500">User #{receiver_id}</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Loading indicator at top */}
        {isLoadingOlder && (
          <div className="flex justify-center py-3">
            <div className="text-sm text-gray-500">Loading older messages...</div>
          </div>
        )}

        {/* Top message marker for infinite scroll */}
        {messages.length > 0 && <div ref={topMessageRef} />}

        {/* No messages state */}
        {messages.length === 0 && !isLoadingOlder && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === user.id}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        receiver_id={receiver_id}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
};

// ==================== HELPER COMPONENTS ====================

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  const timestamp = new Date(message.created_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
          isOwn
            ? "bg-blue-500 text-white rounded-br-none"
            : "bg-gray-200 text-gray-900 rounded-bl-none"
        }`}
      >
        <p className="break-words text-sm">{message.content}</p>
        <p
          className={`mt-1 text-xs ${
            isOwn ? "text-blue-100" : "text-gray-500"
          }`}
        >
          {timestamp}
          {isOwn && message.is_read && " ✓✓"}
        </p>
      </div>
    </div>
  );
};
