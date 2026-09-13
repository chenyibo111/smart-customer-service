import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';
import { transitionConversation } from './conversation-state.js';
import { ConversationRepository, type ConversationRecord } from '../repositories/conversation-repository.js';

export type TicketRecord = {
  id: string;
  conversationId: string;
  reason: string;
  status: 'open' | 'claimed' | 'closed';
  claimedBy: string | null;
  createdAt: string;
  closedAt: string | null;
};

type TicketRow = {
  id: string;
  conversation_id: string;
  reason: string;
  status: TicketRecord['status'];
  claimed_by: string | null;
  created_at: string;
  closed_at: string | null;
};

const toTicket = (ticket: TicketRow): TicketRecord => ({
  id: ticket.id,
  conversationId: ticket.conversation_id,
  reason: ticket.reason,
  status: ticket.status,
  claimedBy: ticket.claimed_by,
  createdAt: ticket.created_at,
  closedAt: ticket.closed_at,
});

export class HandoffService {
  constructor(
    private readonly database: AppDatabase,
    private readonly conversations: ConversationRepository,
  ) {}

  requestHumanHandoff(
    conversationId: string,
    reason: string,
  ): { conversation: ConversationRecord; ticket: TicketRecord } {
    const existing = this.conversations.getById(conversationId);
    if (!existing) throw new Error('conversation not found');

    const conversation = this.conversations.setStatus(
      conversationId,
      transitionConversation(existing.status, 'handoff_requested'),
      'human',
    );
    const ticket: TicketRecord = {
      id: randomUUID(),
      conversationId,
      reason,
      status: 'open',
      claimedBy: null,
      createdAt: new Date().toISOString(),
      closedAt: null,
    };

    this.database
      .prepare('INSERT INTO tickets (id, conversation_id, reason, status, claimed_by, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(ticket.id, ticket.conversationId, ticket.reason, ticket.status, ticket.claimedBy, ticket.createdAt, ticket.closedAt);

    return { conversation, ticket };
  }

  claimTicket(ticketId: string, agentId: string): { conversation: ConversationRecord; ticket: TicketRecord } {
    const row = this.database.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as TicketRow | undefined;
    if (!row) throw new Error('ticket not found');
    if (row.status !== 'open') throw new Error('ticket is not open');

    const current = this.conversations.getById(row.conversation_id);
    if (!current) throw new Error('conversation not found');
    const conversation = this.conversations.setStatus(
      current.id,
      transitionConversation(current.status, 'ticket_claimed'),
      'human',
    );

    this.database.prepare('UPDATE tickets SET status = ?, claimed_by = ? WHERE id = ?').run('claimed', agentId, ticketId);
    const claimed = this.database.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as TicketRow;
    return { conversation, ticket: toTicket(claimed) };
  }

  listOpenTickets(): TicketRecord[] {
    return (this.database.prepare('SELECT * FROM tickets WHERE status = ? ORDER BY created_at').all('open') as TicketRow[]).map(toTicket);
  }

  getTicket(ticketId: string): TicketRecord | undefined {
    const row = this.database.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as TicketRow | undefined;
    return row ? toTicket(row) : undefined;
  }

  closeTicket(ticketId: string): { conversation: ConversationRecord; ticket: TicketRecord } {
    const ticket = this.getTicket(ticketId);
    if (!ticket) throw new Error('ticket not found');
    if (ticket.status !== 'claimed') throw new Error('ticket is not claimed');

    const current = this.conversations.getById(ticket.conversationId);
    if (!current) throw new Error('conversation not found');
    const conversation = this.conversations.setStatus(
      current.id,
      transitionConversation(current.status, 'ticket_closed'),
      'human',
    );
    const closedAt = new Date().toISOString();
    this.database.prepare('UPDATE tickets SET status = ?, closed_at = ? WHERE id = ?').run('closed', closedAt, ticketId);
    return { conversation, ticket: this.getTicket(ticketId)! };
  }
}
