"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@/context/ChatContext";

interface MessageInputProps {
  receiver_id: number;
  onMessageSent?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  receiver_id,
  onMessageSent,
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
    // Send on Ctrl+Enter or Cmd+Enter, but allow Shift+Enter for new lines
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Ctrl+Enter or Cmd+Enter to send)"
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          rows={1}
          maxLength={5000}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!content.trim() || isSending}
          className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {content.length}/5000 characters
      </div>
    </form>
  );
};
