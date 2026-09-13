import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

import { AgentOrchestrator } from './agent/orchestrator.js';
import { DeepSeekClient } from './agent/deepseek-client.js';
import { OrderTool } from './agent/order-tool.js';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/database.js';
import { migrate } from './db/migrate.js';
import { seedDemoOrders } from './db/seed.js';
import { HandoffService } from './domain/handoff-service.js';
import { LocalEmbeddingProvider } from './knowledge/embedder.js';
import { Retriever } from './knowledge/retriever.js';
import { ConversationRepository } from './repositories/conversation-repository.js';
import { KnowledgeRepository } from './repositories/knowledge-repository.js';
import { TraceRepository } from './repositories/trace-repository.js';

loadEnvironment({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const config = loadConfig(process.env);
const databasePath = resolve(config.databasePath);
mkdirSync(dirname(databasePath), { recursive: true });
const database = createDatabase(databasePath);
migrate(database);
seedDemoOrders(database);

const conversations = new ConversationRepository(database);
const retriever = new Retriever(new KnowledgeRepository(database), new LocalEmbeddingProvider(), config.ragMinScore);
const agent = new AgentOrchestrator({
  conversations,
  traces: new TraceRepository(database),
  handoffs: new HandoffService(database, conversations),
  retriever,
  model: new DeepSeekClient({ apiKey: config.deepseekApiKey, baseUrl: config.deepseekBaseUrl, model: config.deepseekModel }),
  orderTool: new OrderTool(database),
});
const app = buildApp({ database, agent, indexer: retriever });

await app.listen({ port: config.port, host: '127.0.0.1' });
