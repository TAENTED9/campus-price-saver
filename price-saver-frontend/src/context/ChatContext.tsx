"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { messageApi, type Message, type Conversation } from "@/lib/messageApi";
import { useWebSocket, type ChatWsMessage, type TypingEvent } from "@/hooks/useWebSocket";
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

  // Typing indicators — keyed by conversation_id
  typingUsers: Record<number, Set<number>>;

  // Actions
  loadConversations: () => Promise<void>;
  setActiveConversation: (conversation: Conversation) => void;
  loadInitialMessages: (conversation_id: number) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (receiver_id: number, content: string) => Promise<void>;
  sendTyping: (conversation_id: number, isTyping: boolean) => void;
  clearActiveConversation: () => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

/**
 * Dedupe a message list by id, keeping the LAST occurrence (so a freshly
 * fetched/real message wins over an older copy). This is the single guard that
 * prevents React "duplicate key" warnings no matter which path mutates the
 * list — pagination overlap, WS echo, or optimistic replacement.
 */
function dedupeById(messages: Message[]): Message[] {
  const byId = new Map<number, Message>();
  for (const m of messages) byId.set(m.id, m);
  return Array.from(byId.values());
}

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
  const [typingUsers, setTypingUsers] = useState<Record<number, Set<number>>>({});
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Monotonically-decreasing temp id for optimistic messages so two in-flight
  // sends never collide on the same React key (the old fixed -1 did).
  const nextTempId = useRef(-1);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoadingConversations(true);
      const response = await messageApi.fetchConversations(20, 0, token);
      // Deduplicate by ID to prevent React duplicate-key warnings
      const seen = new Set<number>();
      const unique = response.conversations.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      setConversations(unique);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [token]);

  // Set active conversation (when user clicks on conversation list)
  const setActiveConversation = useCallback(
    (conversation: Conversation) => {
      if (conversation.id === activeConversation?.id) return;
      setActiveConversationState(conversation);
      // Reset messages and pagination state when switching conversations
      setMessages([]);
      setCursor(null);
      setHasEarlierMessages(false);
      setTotalMessageCount(0);
    },
    [activeConversation]
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

        // Deduplicate messages by ID
        const msgSeen = new Set<number>();
        const uniqueMessages = response.messages.filter((m) => {
          if (msgSeen.has(m.id)) return false;
          msgSeen.add(m.id);
          return true;
        });
        setMessages(uniqueMessages);
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

      // Prepend older messages, then dedupe — cursor pagination can overlap the
      // boundary message, which previously produced duplicate React keys.
      setMessages((prev) => dedupeById([...response.messages, ...prev]));
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

      // Declared outside try so the catch can roll back this exact entry.
      const tempId = nextTempId.current--;

      try {
        // Optimistic update: add message immediately to UI with a UNIQUE temp id
        const myNumericId = user?.id ?? 0;
        const optimisticMessage: Message = {
          id: tempId,
          conversation_id: activeConversation?.id || 0,
          sender_id: myNumericId,
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

        // Drop this optimistic entry and add the real message, deduped — handles
        // the race where the WS broadcast already added the real one.
        setMessages((prev) =>
          dedupeById([...prev.filter((m) => m.id !== tempId), newMessage])
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
        // Remove this send's optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
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

  // ── Typing indicator handling ─────────────────────────────────────────
  const handleTypingEvent = useCallback((event: TypingEvent) => {
    const convId = event.conversation_id;
    const uid = event.user_id;
    if (event.type === "typing_start") {
      setTypingUsers((prev) => {
        const next = { ...prev };
        const s = new Set(next[convId] ?? []);
        s.add(uid);
        next[convId] = s;
        return next;
      });
      // Auto-clear after 4 s if no stop event arrives
      if (typingTimers.current[uid]) clearTimeout(typingTimers.current[uid]);
      typingTimers.current[uid] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          const s = new Set(next[convId] ?? []);
          s.delete(uid);
          next[convId] = s;
          return next;
        });
      }, 4000);
    } else {
      if (typingTimers.current[uid]) clearTimeout(typingTimers.current[uid]);
      setTypingUsers((prev) => {
        const next = { ...prev };
        const s = new Set(next[convId] ?? []);
        s.delete(uid);
        next[convId] = s;
        return next;
      });
    }
  }, []);

  // ── Real-time incoming messages via WebSocket ────────────────────────────
  const handleWsMessage = useCallback(
    (wsMsg: ChatWsMessage) => {
      const convId = Number(wsMsg.conversation_uuid);
      setMessages((prev) => {
        // Skip if we already have this real message (REST replacement or echo).
        if (prev.some((m) => m.id === Number(wsMsg.id))) return prev;
        return dedupeById([
          ...prev,
          {
            id: Number(wsMsg.id),
            conversation_id: convId,
            sender_id: wsMsg.sender_id,
            content: wsMsg.content,
            created_at: wsMsg.created_at,
            is_read: wsMsg.is_read,
          },
        ]);
      });
      // Refresh conversation list preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, last_message_preview: wsMsg.content, last_message_at: wsMsg.created_at }
            : c
        )
      );
    },
    []
  );

  const wsConvId = activeConversation ? String(activeConversation.id) : null;
  const { send: wsSend } = useWebSocket(wsConvId, token, handleWsMessage, handleTypingEvent);

  const sendTyping = useCallback(
    (conversation_id: number, isTyping: boolean) => {
      wsSend({ type: isTyping ? "typing_start" : "typing_stop", conversation_id });
    },
    [wsSend]
  );

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
    typingUsers,
    loadConversations,
    setActiveConversation,
    loadInitialMessages,
    loadOlderMessages,
    sendMessage,
    sendTyping,
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
