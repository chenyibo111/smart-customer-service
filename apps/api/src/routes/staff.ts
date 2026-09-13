import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HandoffService } from '../domain/handoff-service.js';
import type { ConversationRepository } from '../repositories/conversation-repository.js';

const claimInput = z.object({ agentId: z.string().trim().min(1).max(100) });
const agentMessageInput = z.object({ content: z.string().trim().min(1).max(5000) });

export async function registerStaffRoutes(
  app: FastifyInstance,
  dependencies: { conversations: ConversationRepository; handoffs: HandoffService },
): Promise<void> {
  app.get('/api/agent/tickets', async () => ({ tickets: dependencies.handoffs.listOpenTickets() }));

  app.post('/api/agent/tickets/:id/claim', async (request, reply) => {
    const parsed = claimInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', message: '坐席标识无效。' });
    try {
      return dependencies.handoffs.claimTicket((request.params as { id: string }).id, parsed.data.agentId);
    } catch {
      return reply.code(409).send({ code: 'TICKET_UNAVAILABLE', message: '工单无法接管。' });
    }
  });

  app.post('/api/agent/tickets/:id/messages', async (request, reply) => {
    const parsed = agentMessageInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', message: '回复内容无效。' });
    const ticket = dependencies.handoffs.getTicket((request.params as { id: string }).id);
    if (!ticket || ticket.status !== 'claimed') return reply.code(409).send({ code: 'TICKET_UNAVAILABLE', message: '请先接管工单。' });

    const message = dependencies.conversations.appendMessage({
      conversationId: ticket.conversationId,
      role: 'agent',
      content: parsed.data.content,
    });
    return reply.code(201).send({ message });
  });

  app.post('/api/agent/tickets/:id/close', async (request, reply) => {
    try {
      return dependencies.handoffs.closeTicket((request.params as { id: string }).id);
    } catch {
      return reply.code(409).send({ code: 'TICKET_UNAVAILABLE', message: '工单无法关闭。' });
    }
  });
}
