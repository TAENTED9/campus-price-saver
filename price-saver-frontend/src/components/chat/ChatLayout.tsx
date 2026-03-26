"use client";

import React, { useState } from "react";
import { Conversation } from "@/lib/messageApi";
import { useChat } from "@/context/ChatContext";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";

/**
 * Main chat layout component
 * Combines conversation list (left) and chat window (right)
 * Responsive: stacks on mobile, 2-column on desktop
 */
export const ChatLayout: React.FC = () => {
  const { setActiveConversation, activeConversation } = useChat();
  const [showChat, setShowChat] = useState(false); // For mobile: toggle between list and chat

  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    setShowChat(true); // On mobile, show chat view
  };

  const handleBackToList = () => {
    setShowChat(false);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Conversation List - Hidden on mobile when chat is open */}
      <div
        className={`w-full md:w-96 bg-white border-r border-gray-200 flex flex-col
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
        className={`flex-1 bg-white flex flex-col
          ${showChat ? "flex" : "hidden md:flex"}
        `}
      >
        {activeConversation ? (
          <>
            {/* Mobile header with back button */}
            <div className="md:hidden border-b border-gray-200 px-4 py-3 flex items-center gap-3">
              <button
                onClick={handleBackToList}
                className="text-blue-500 hover:text-blue-600 font-medium"
              >
                ← Back
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {activeConversation.other_user_name || "User"}
              </h2>
            </div>

            <ChatWindow
              conversation_id={activeConversation.id}
              receiver_id={activeConversation.other_user_id || 0}
              receiver_name={activeConversation.other_user_name}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};
