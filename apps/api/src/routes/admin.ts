import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { KnowledgeRepository } from '../repositories/knowledge-repository.js';
import type { ConversationRepository } from '../repositories/conversation-repository.js';
import type { TraceRepository } from '../repositories/trace-repository.js';

const documentInput = z.object({
  title: z.string().trim().min(1).max(200),
  markdown: z.string().trim().min(1).max(100_000),
});

export type DocumentIndexer = {
  indexDocument(input: { title: string; markdown: string }): Promise<void>;
};

export async function registerAdminRoutes(
  app: FastifyInstance,
  dependencies: { knowledge: KnowledgeRepository; conversations: ConversationRepository; traces: TraceRepository; indexer?: DocumentIndexer },
): Promise<void> {
  app.post('/api/admin/documents', async (request, reply) => {
    const parsed = documentInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', message: '知识内容无效。' });
    if (!dependencies.indexer) return reply.code(503).send({ code: 'SERVICE_UNAVAILABLE', message: '知识库暂时不可用。' });

    try {
      await dependencies.indexer.indexDocument(parsed.data);
      return reply.code(201).send({ ok: true });
    } catch {
      return reply.code(503).send({ code: 'SERVICE_UNAVAILABLE', message: '知识库暂时不可用。' });
    }
  });

  app.get('/api/admin/documents', async () => ({ documents: dependencies.knowledge.listDocuments() }));

  app.get('/api/admin/conversations', async () => ({ conversations: dependencies.conversations.listRecent() }));

  app.get('/api/admin/conversations/:id/replay', async (request) => dependencies.traces.getReplay((request.params as { id: string }).id));
}
