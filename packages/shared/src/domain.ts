export type ConversationStatus =
  | 'ai_processing'
  | 'ai_replied'
  | 'waiting_human'
  | 'human_active'
  | 'resolved';

export type MessageRole = 'customer' | 'assistant' | 'agent' | 'system';

export type Conversation = {
  id: string;
  visitorId: string;
  status: ConversationStatus;
  controller: 'agent' | 'human' | null;
  createdAt: string;
  closedAt: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};
