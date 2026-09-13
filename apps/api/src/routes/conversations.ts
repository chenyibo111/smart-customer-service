import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HandoffService } from '../domain/handoff-service.js';
import type { ConversationRepository } from '../repositories/conversation-repository.js';
import type { AgentEvent } from '../agent/orchestrator.js';

const createConversationInput = z.object({ visitorId: z.string().trim().min(1).max(100) });
const handoffInput = z.object({ reason: z.enum(['customer_requested', 'insufficient_knowledge', 'service_failure']).default('customer_requested') });
const messageInput = z.object({ content: z.string().trim().min(1).max(5000) });

export type AgentResponder = {
  respond(input: { conversationId: string; message: string }): AsyncIterable<AgentEvent>;
};

export async function registerConversationRoutes(
  app: FastifyInstance,
  dependencies: { conversations: ConversationRepository; handoffs: HandoffService; agent?: AgentResponder },
): Promise<void> {
  app.post('/api/conversations', async (request, reply) => {
    const parsed = createConversationInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', message: '请提供访客标识。' });

    return reply.code(201).send({ conversation: dependencies.conversations.create(parsed.data.visitorId) });
  });

  app.post('/api/conversations/:id/handoff', async (request, reply) => {
    const parsed = handoffInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', message: '转人工请求无效。' });

    try {
      return dependencies.handoffs.requestHumanHandoff((request.params as { id: string }).id, parsed.data.reason);
    } catch {
      return reply.code(404).send({ code: 'NOT_FOUND', message: '会话不存在或已结束。' });
    }
  });

  app.post('/api/conversations/:id/messages', async (request, reply) => {
    const parsed = messageInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', message: '消息内容无效。' });
    if (!dependencies.agent) return reply.code(503).send({ code: 'SERVICE_UNAVAILABLE', message: '暂时无法处理，已为你转接人工客服。' });

    const conversationId = (request.params as { id: string }).id;
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    for await (const event of dependencies.agent.respond({ conversationId, message: parsed.data.content })) {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
    reply.raw.end();
  });
}
