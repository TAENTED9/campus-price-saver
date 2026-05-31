"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { Message } from "@/lib/messageApi";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { MessageInput } from "./MessageInput";
import { formatTimeWAT } from "@/utils/date";

interface ChatWindowProps {
  conversation_id: number;
  receiver_id: number;
  receiver_name?: string;
  receiver_avatar?: string | null;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation_id,
  receiver_id,
  receiver_name = "User",
  receiver_avatar,
}) => {
  const { user } = useAuth();
  const {
    messages,
    isLoadingOlder,
    loadInitialMessages,
    loadOlderMessages,
    typingUsers,
    sendTyping,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const topMessageRef = useRef<HTMLDivElement>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTypingSent, setIsTypingSent] = useState(false);

  // Load initial messages on mount
  useEffect(() => {
    loadInitialMessages(conversation_id);
  }, [conversation_id, loadInitialMessages]);

  // Setup IntersectionObserver for infinite scroll (loading older messages)
  useEffect(() => {
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect();
    }

    intersectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingOlder && messages.length > 0) {
          loadOlderMessages();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
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
    // Stop typing + scroll on send
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    if (isTypingSent) {
      sendTyping(conversation_id, false);
      setIsTypingSent(false);
    }
    setTimeout(scrollToBottom, 100);
  };

  const handleTypingInput = useCallback(() => {
    if (!isTypingSent) {
      sendTyping(conversation_id, true);
      setIsTypingSent(true);
    }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(() => {
      sendTyping(conversation_id, false);
      setIsTypingSent(false);
    }, 3000);
  }, [conversation_id, isTypingSent, sendTyping]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    };
  }, []);

  // Typing users in this conversation (excluding self)
  const myNumericId = user ? (user.numeric_id ?? Number(user.id)) : 0;
  const typersInConv = user
    ? [...(typingUsers[conversation_id] ?? [])].filter((uid) => uid !== myNumericId)
    : [];
  const someoneIsTyping = typersInConv.length > 0;

  if (!user) {
    return <div className="flex items-center justify-center h-full">Please log in to message</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0 flex items-center gap-3">
        {receiver_avatar ? (
          <img
            src={receiver_avatar}
            alt={receiver_name}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {receiver_name.trim().slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">{receiver_name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {someoneIsTyping ? (
              <span className="text-brand-500 font-medium">Typing…</span>
            ) : (
              "Direct message"
            )}
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-3 scrollbar-hide">
        {isLoadingOlder && (
          <div className="flex justify-center py-3">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {messages.length > 0 && <div ref={topMessageRef} />}

        {messages.length === 0 && !isLoadingOlder && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 dark:text-gray-600 py-12">
            <p className="text-sm">No messages yet — say hello!</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === myNumericId}
          />
        ))}

        {/* Typing indicator bubble */}
        {someoneIsTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg rounded-bl-none px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        receiver_id={receiver_id}
        onMessageSent={handleMessageSent}
        onTyping={handleTypingInput}
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
  // formatTimeWAT normalizes naive-UTC server timestamps and renders in WAT, so
  // chat times match the wall clock instead of showing an hour behind.
  const timestamp = formatTimeWAT(message.created_at);

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
