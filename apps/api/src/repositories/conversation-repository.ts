import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';

export type ConversationRecord = {
  id: string;
  visitorId: string;
  status: 'ai_processing' | 'ai_replied' | 'waiting_human' | 'human_active' | 'resolved';
  controller: 'agent' | 'human' | null;
  createdAt: string;
  closedAt: string | null;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  role: 'customer' | 'assistant' | 'agent' | 'system';
  content: string;
  createdAt: string;
};

type ConversationRow = {
  id: string;
  visitor_id: string;
  status: ConversationRecord['status'];
  controller: ConversationRecord['controller'];
  created_at: string;
  closed_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: MessageRecord['role'];
  content: string;
  created_at: string;
};

const toConversation = (row: ConversationRow): ConversationRecord => ({
  id: row.id,
  visitorId: row.visitor_id,
  status: row.status,
  controller: row.controller,
  createdAt: row.created_at,
  closedAt: row.closed_at,
});

const toMessage = (row: MessageRow): MessageRecord => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
});

export class ConversationRepository {
  constructor(private readonly database: AppDatabase) {}

  create(visitorId: string): ConversationRecord {
    const conversation: ConversationRecord = {
      id: randomUUID(),
      visitorId,
      status: 'ai_replied',
      controller: 'agent',
      createdAt: new Date().toISOString(),
      closedAt: null,
    };

    this.database
      .prepare('INSERT INTO conversations (id, visitor_id, status, controller, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(conversation.id, conversation.visitorId, conversation.status, conversation.controller, conversation.createdAt, conversation.closedAt);

    return conversation;
  }

  appendMessage(input: Omit<MessageRecord, 'id' | 'createdAt'>): MessageRecord {
    const message: MessageRecord = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
    this.database
      .prepare('INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(message.id, message.conversationId, message.role, message.content, message.createdAt);
    return message;
  }

  getById(id: string): ConversationRecord | undefined {
    const row = this.database.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    return row ? toConversation(row) : undefined;
  }

  setStatus(
    id: string,
    status: ConversationRecord['status'],
    controller: ConversationRecord['controller'],
  ): ConversationRecord {
    this.database
      .prepare('UPDATE conversations SET status = ?, controller = ? WHERE id = ?')
      .run(status, controller, id);
    const conversation = this.getById(id);
    if (!conversation) throw new Error('conversation not found');
    return conversation;
  }

  listMessages(conversationId: string): MessageRecord[] {
    return (this.database.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(conversationId) as MessageRow[]).map(toMessage);
  }
}
