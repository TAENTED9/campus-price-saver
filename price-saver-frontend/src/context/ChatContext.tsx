"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { messageApi, type Message, type Conversation } from "@/lib/messageApi";
import { useAuth } from "./AuthContext";

type ChatContextType = {
  // State
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoadingOlder: boolean;
  isLoadingConversations: boolean;
  cursor: number | null;
  hasEarlierMessages: boolean;
  totalMessageCount: number;

  // Actions
  loadConversations: () => Promise<void>;
  setActiveConversation: (conversation: Conversation) => void;
  loadInitialMessages: (conversation_id: number) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (receiver_id: number, content: string) => Promise<void>;
  clearActiveConversation: () => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token, user } = useAuth();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversationState] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasEarlierMessages, setHasEarlierMessages] = useState(false);
  const [totalMessageCount, setTotalMessageCount] = useState(0);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoadingConversations(true);
      const response = await messageApi.fetchConversations(20, 0, token);
      setConversations(response.conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [token]);

  // Set active conversation (when user clicks on conversation list)
  const setActiveConversation = useCallback(
    (conversation: Conversation) => {
      setActiveConversationState(conversation);
      // Reset messages and pagination state when switching conversations
      setMessages([]);
      setCursor(null);
      setHasEarlierMessages(false);
      setTotalMessageCount(0);
    },
    []
  );

  // Load initial messages (most recent messages, no cursor)
  const loadInitialMessages = useCallback(
    async (conversation_id: number) => {
      if (!token) return;

      try {
        setIsLoadingOlder(true);
        const response = await messageApi.fetchMessages(
          conversation_id,
          20,
          undefined,
          token
        );

        setMessages(response.messages);
        setCursor(response.cursor);
        setHasEarlierMessages(response.has_earlier);
        setTotalMessageCount(response.total_count);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoadingOlder(false);
      }
    },
    [token]
  );

  // Load older messages (with cursor for pagination)
  const loadOlderMessages = useCallback(async () => {
    if (!activeConversation || !token || !cursor || !hasEarlierMessages) {
      return;
    }

    try {
      setIsLoadingOlder(true);
      const response = await messageApi.fetchMessages(
        activeConversation.id,
        20,
        cursor,
        token
      );

      // Prepend older messages to the beginning
      setMessages((prev) => [...response.messages, ...prev]);
      setCursor(response.cursor);
      setHasEarlierMessages(response.has_earlier);
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [activeConversation, token, cursor, hasEarlierMessages]);

  // Send message
  const sendMessage = useCallback(
    async (receiver_id: number, content: string) => {
      if (!token) return;

      try {
        // Optimistic update: add message immediately to UI
        const optimisticMessage: Message = {
          id: -1, // Temporary ID
          conversation_id: activeConversation?.id || 0,
          sender_id: user?.id || 0,
          content,
          created_at: new Date().toISOString(),
          is_read: false,
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        // Send to backend
        const newMessage = await messageApi.sendMessage(
          receiver_id,
          content,
          token
        );

        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((msg) => (msg.id === -1 ? newMessage : msg))
        );

        // Update conversations list with this message
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === newMessage.conversation_id) {
              return {
                ...conv,
                last_message_at: newMessage.created_at,
                last_message_preview: newMessage.content.substring(0, 500),
              };
            }
            return conv;
          })
        );

        // Update active conversation if it's the one we're chatting with
        if (activeConversation?.id === newMessage.conversation_id) {
          setActiveConversationState({
            ...activeConversation,
            last_message_at: newMessage.created_at,
            last_message_preview: newMessage.content.substring(0, 500),
          });
        }
      } catch (error) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== -1));
        console.error("Failed to send message:", error);
        throw error;
      }
    },
    [token, user, activeConversation]
  );

  // Clear active conversation
  const clearActiveConversation = useCallback(() => {
    setActiveConversationState(null);
    setMessages([]);
    setCursor(null);
    setHasEarlierMessages(false);
    setTotalMessageCount(0);
  }, []);

  // Auto-load conversations on mount
  useEffect(() => {
    if (token) {
      loadConversations();
    }
  }, [token, loadConversations]);

  const value: ChatContextType = {
    conversations,
    activeConversation,
    messages,
    isLoadingOlder,
    isLoadingConversations,
    cursor,
    hasEarlierMessages,
    totalMessageCount,
    loadConversations,
    setActiveConversation,
    loadInitialMessages,
    loadOlderMessages,
    sendMessage,
    clearActiveConversation,
  };

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};
