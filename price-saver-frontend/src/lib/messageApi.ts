/**
 * Message API Client - Full message persistence with pagination
 * Handles all communication with backend messaging endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ===================== TYPES =====================

export type Message = {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
};

export type Conversation = {
  id: number;
  user_a_id: number;
  user_b_id: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  unread_count?: number;
  // Added by frontend logic
  other_user_id?: number;
  other_user_name?: string;
  other_user_avatar?: string | null;
};

export type MessageListResponse = {
  messages: Message[];
  has_earlier: boolean;
  cursor: number | null;
  total_count: number;
};

export type ConversationListResponse = {
  conversations: Conversation[];
  total_count: number;
};

export type ApiError = {
  detail: string;
};

// ===================== HELPERS =====================

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    const message =
      typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((e: any) => e.msg || "Error").join("; ")
          : "Request failed";

    throw new Error(message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ===================== MESSAGE API =====================

export const messageApi = {
  /**
   * Send a message to another user
   * Creates or finds conversation and creates message record
   */
  async sendMessage(
    receiver_id: number,
    content: string,
    token: string
  ): Promise<Message> {
    return request<Message>(
      `/api/messages/send`,
      {
        method: "POST",
        body: JSON.stringify({ receiver_id, content }),
      },
      token
    );
  },

  /**
   * Fetch messages from a conversation with cursor-based pagination
   * Returns messages in ascending order (oldest first)
   */
  async fetchMessages(
    conversation_id: number,
    limit: number = 20,
    cursor?: number,
    token?: string
  ): Promise<MessageListResponse> {
    let endpoint = `/api/messages/conversation/${conversation_id}?limit=${limit}`;
    if (cursor) {
      endpoint += `&cursor=${cursor}`;
    }
    return request<MessageListResponse>(endpoint, {}, token);
  },

  /**
   * Get all conversations for the current user
   * Sorted by last_message_at descending (most recent first)
   */
  async fetchConversations(
    limit: number = 20,
    offset: number = 0,
    token?: string
  ): Promise<ConversationListResponse> {
    const endpoint = `/api/messages/conversations?limit=${limit}&offset=${offset}`;
    return request<ConversationListResponse>(endpoint, {}, token);
  },

  /**
   * Start a conversation with a user, or return the existing one
   */
  async startConversation(
    target_user_id: number,
    token: string
  ): Promise<Conversation> {
    return request<Conversation>(
      `/api/messages/conversations`,
      {
        method: "POST",
        body: JSON.stringify({ target_user_id }),
      },
      token
    );
  },

  /**
   * Get total unread direct-message count (for the nav badge)
   */
  async getUnreadCount(
    token: string
  ): Promise<{ unread_count: number }> {
    return request<{ unread_count: number }>(
      `/api/messages/conversations/unread-count`,
      {},
      token
    );
  },

  /**
   * Mark all messages in a conversation as read
   * (Future feature: currently a placeholder)
   */
  async markConversationAsRead(
    conversation_id: number,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(
      `/api/messages/conversation/${conversation_id}/mark-read`,
      {
        method: "PATCH",
      },
      token
    );
  },
};

// ===================== QUERY BUILDERS =====================

/**
 * Build query string for fetch requests
 * Useful for reusing endpoint URLs in effect dependencies
 */
export function buildFetchMessagesUrl(
  conversation_id: number,
  limit?: number,
  cursor?: number
): string {
  let url = `/api/messages/conversation/${conversation_id}?`;
  const params = new URLSearchParams();

  if (limit) params.append("limit", limit.toString());
  if (cursor) params.append("cursor", cursor.toString());

  return url + params.toString();
}

export function buildFetchConversationsUrl(
  limit?: number,
  offset?: number
): string {
  let url = `/api/messages/conversations?`;
  const params = new URLSearchParams();

  if (limit) params.append("limit", limit.toString());
  if (offset) params.append("offset", offset.toString());

  return url + params.toString();
}
