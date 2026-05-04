"use client";

import React, { useState, useEffect } from "react";
import { Conversation } from "@/lib/messageApi";
import { useChat } from "@/context/ChatContext";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";

interface ChatLayoutProps {
  /** When set (from ?conv= URL param), auto-open this conversation on load */
  initialConversationId?: number;
}

/**
 * Main chat layout component
 * Combines conversation list (left) and chat window (right)
 * Responsive: stacks on mobile, 2-column on desktop
 */
export const ChatLayout: React.FC<ChatLayoutProps> = ({ initialConversationId }) => {
  const { setActiveConversation, activeConversation, conversations, isLoadingConversations } = useChat();
  const [showChat, setShowChat] = useState(false); // For mobile: toggle between list and chat

  // Auto-select the conversation that matches initialConversationId once loaded
  useEffect(() => {
    if (!initialConversationId || isLoadingConversations || activeConversation) return;
    const target = conversations.find((c) => c.id === initialConversationId);
    if (target) {
      setActiveConversation(target);
      setShowChat(true);
    }
  }, [initialConversationId, conversations, isLoadingConversations, activeConversation, setActiveConversation]);

  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    setShowChat(true); // On mobile, show chat view
  };

  const handleBackToList = () => {
    setShowChat(false);
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Conversation List - Hidden on mobile when chat is open */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col
          ${showChat ? "hidden md:flex" : "flex"}
        `}
      >
        <ConversationList
          onSelectConversation={handleSelectConversation}
          selectedConversationId={activeConversation?.id}
        />
      </div>

      {/* Chat Window - Hidden on mobile when list is open */}
      <div
        className={`flex-1 flex flex-col min-w-0
          ${showChat ? "flex" : "hidden md:flex"}
        `}
      >
        {activeConversation ? (
          <>
            {/* Mobile header with back button */}
            <div className="md:hidden px-4 py-3 flex items-center gap-3">
              <button
                onClick={handleBackToList}
                className="text-brand-500 hover:text-brand-600 font-medium text-sm"
              >
                ← Back
              </button>
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {activeConversation.other_user_name || "User"}
              </h2>
            </div>

            <ChatWindow
              conversation_id={activeConversation.id}
              receiver_id={activeConversation.other_user_id || 0}
              receiver_name={activeConversation.other_user_name}
              receiver_avatar={activeConversation.other_user_avatar}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-600">
            <p className="text-sm">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};
