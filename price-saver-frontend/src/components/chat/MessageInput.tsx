"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@/context/ChatContext";

interface MessageInputProps {
  receiver_id: number;
  onMessageSent?: () => void;
  onTyping?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  receiver_id,
  onMessageSent,
  onTyping,
}) => {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useChat();

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(
        textareaRef.current.scrollHeight,
        120
      ).toString() + "px";
    }
  }, [content]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;

    try {
      setIsSending(true);
      await sendMessage(receiver_id, trimmedContent);
      setContent("");
      onMessageSent?.();
    } catch (error) {
      console.error("Error sending message:", error);
      // Error handling could show a toast notification here
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <form onSubmit={handleSendMessage} className="p-3 flex-shrink-0">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); onTyping?.(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 scrollbar-hide"
          rows={1}
          maxLength={4000}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!content.trim() || isSending}
          className="h-[38px] w-11 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors flex-shrink-0"
        >
          {isSending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
        </button>
      </div>
    </form>
  );
};
