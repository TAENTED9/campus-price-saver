"use client";

import React, { useState } from "react";
import { Conversation } from "@/lib/messageApi";
import { useChat } from "@/context/ChatContext";
import { formatRelativeTime } from "@/utils/date";

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

  // Use the shared WAT-aware formatter. The previous inline `new Date(str)`
  // parsed naive-UTC timestamps as local time, making every relative time an
  // hour off — the messaging "1h late" bug.
  const formatTime = (dateString: string | null) => {
    if (!dateString) return "No messages";
    return formatRelativeTime(dateString);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-[15px] font-black text-gray-900 dark:text-white tracking-tight mb-3">Messages</h1>

        {/* Search Input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations…"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
        />
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12 text-gray-400 dark:text-gray-600">
            <p className="text-sm">
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
      <div className="p-3">
        <button
          onClick={loadConversations}
          disabled={isLoadingConversations}
          className="w-full rounded-xl bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 transition-colors"
        >
          {isLoadingConversations ? "Refreshing…" : "Refresh"}
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
  const name = conversation.other_user_name || `User #${conversation.other_user_id}`;
  const initials = name.trim().slice(0, 2).toUpperCase();
  const hasUnread = (conversation.unread_count ?? 0) > 0;

  return (
    <button
      onClick={onSelect}
      className={`w-full border-b border-gray-100 dark:border-gray-800/60 px-3 py-3 text-left transition-colors flex items-start gap-2.5 ${
        isSelected
          ? "bg-brand-50 dark:bg-brand-500/10"
          : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      }`}
    >
      {/* Avatar */}
      {conversation.other_user_avatar ? (
        <img
          src={conversation.other_user_avatar}
          alt={name}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <span className={`text-[13px] font-semibold truncate ${hasUnread ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>
            {name}
          </span>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
            {formatTime(conversation.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs truncate ${hasUnread ? "text-gray-700 dark:text-gray-200 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
            {conversation.last_message_preview
              ? conversation.last_message_preview.slice(0, 40)
              : "No messages yet"}
          </p>
          {hasUnread && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
              {(conversation.unread_count ?? 0) > 9 ? "9+" : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
