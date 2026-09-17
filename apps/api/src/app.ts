import cors from '@fastify/cors';
import Fastify from 'fastify';

import type { AppDatabase } from './db/database.js';
import { HandoffService } from './domain/handoff-service.js';
import type { EvaluationRunner } from './evaluations/runner.js';
import { KnowledgeRepository } from './repositories/knowledge-repository.js';
import { ConversationRepository } from './repositories/conversation-repository.js';
import { EvaluationRepository } from './repositories/evaluation-repository.js';
import { TraceRepository } from './repositories/trace-repository.js';
import { registerAdminRoutes, type DocumentIndexer } from './routes/admin.js';
import { registerConversationRoutes, type AgentResponder } from './routes/conversations.js';
import { registerStaffRoutes } from './routes/staff.js';

export function buildApp(input: { database: AppDatabase; agent?: AgentResponder; indexer?: DocumentIndexer; evaluations?: EvaluationRunner }) {
  const app = Fastify({ logger: false });
  const conversations = new ConversationRepository(input.database);
  const handoffs = new HandoffService(input.database, conversations);
  const knowledge = new KnowledgeRepository(input.database);
  const traces = new TraceRepository(input.database);
  const evaluationRepository = new EvaluationRepository(input.database);

  void app.register(cors, { origin: true });
  void app.register(registerConversationRoutes, { conversations, handoffs, agent: input.agent });
  void app.register(registerStaffRoutes, { conversations, handoffs });
  void app.register(registerAdminRoutes, {
    knowledge,
    conversations,
    traces,
    indexer: input.indexer,
    evaluations: input.evaluations,
    evaluationRepository,
  });
  app.get('/health', async () => ({ ok: true }));

  return app;
}
