"use client";

import React, { useState } from "react";
import { Conversation } from "@/lib/messageApi";
import { useChat } from "@/context/ChatContext";

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId?: number;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  selectedConversationId,
}) => {
  const { conversations, isLoadingConversations, loadConversations } =
    useChat();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter conversations by user name
  const filteredConversations = conversations.filter((conv) =>
    (conv.other_user_name || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "No messages";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Messages</h1>

        {/* Search Input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
        />
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>
              {conversations.length === 0
                ? "No conversations yet"
                : "No matching conversations"}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onSelect={() => onSelectConversation(conversation)}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={loadConversations}
          disabled={isLoadingConversations}
          className="w-full rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

// ==================== HELPER COMPONENTS ====================

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  formatTime: (dateString: string | null) => string;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onSelect,
  formatTime,
}) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
        isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
      }`}
    >
      <div className="flex justify-between items-start gap-2 mb-1">
        <h3 className="font-semibold text-gray-900 truncate">
          {conversation.other_user_name || `User #${conversation.other_user_id}`}
        </h3>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {formatTime(conversation.last_message_at)}
        </span>
      </div>

      <p className="text-sm text-gray-600 truncate">
        {conversation.last_message_preview || "No messages yet"}
      </p>
    </button>
  );
};
