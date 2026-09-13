import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentOrchestrator, type RetrievalService } from '../src/agent/orchestrator.js';
import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { HandoffService } from '../src/domain/handoff-service.js';
import { ConversationRepository } from '../src/repositories/conversation-repository.js';
import { TraceRepository } from '../src/repositories/trace-repository.js';

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of stream) result.push(item);
  return result;
}

describe('AgentOrchestrator', () => {
  let database: AppDatabase;

  beforeEach(() => {
    database = createDatabase(':memory:');
    migrate(database);
  });

  afterEach(() => database.close());

  it('hands off rather than fabricating an answer without retrieval evidence', async () => {
    const conversations = new ConversationRepository(database);
    const conversation = conversations.create('visitor-1');
    const retriever: RetrievalService = { search: async () => [] };
    const orchestrator = new AgentOrchestrator({
      conversations,
      traces: new TraceRepository(database),
      handoffs: new HandoffService(database, conversations),
      retriever,
    });

    const events = await collect(orchestrator.respond({
      conversationId: conversation.id,
      message: '你们的线下门店在哪里？',
    }));

    expect(events).toEqual([
      expect.objectContaining({ type: 'handoff', reason: 'insufficient_knowledge' }),
    ]);
    expect(conversations.getById(conversation.id)).toMatchObject({ status: 'waiting_human', controller: 'human' });
  });
});
