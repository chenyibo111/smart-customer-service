import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { ConversationRepository } from '../src/repositories/conversation-repository.js';
import { TraceRepository } from '../src/repositories/trace-repository.js';

describe('customer-service persistence', () => {
  let database: AppDatabase;
  let conversations: ConversationRepository;
  let traces: TraceRepository;

  beforeEach(() => {
    database = createDatabase(':memory:');
    migrate(database);
    conversations = new ConversationRepository(database);
    traces = new TraceRepository(database);
  });

  afterEach(() => database.close());

  it('persists messages and a replayable masked tool-call trace', () => {
    const conversation = conversations.create('visitor-1');
    const message = conversations.appendMessage({
      conversationId: conversation.id,
      role: 'customer',
      content: 'A1001 到哪了？',
    });
    const run = traces.createRun({
      conversationId: conversation.id,
      triggerMessageId: message.id,
      model: 'test-model',
    });

    traces.recordToolCall({
      runId: run.id,
      name: 'query_order',
      maskedArguments: '{"orderId":"A***1"}',
      result: '已发货',
      status: 'succeeded',
    });

    const replay = traces.getReplay(conversation.id);
    expect(replay.messages).toHaveLength(1);
    expect(replay.toolCalls).toEqual([
      expect.objectContaining({ name: 'query_order', maskedArguments: '{"orderId":"A***1"}', result: '已发货' }),
    ]);
  });
});
