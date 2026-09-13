import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentOrchestrator, type ChatModel, type RetrievalService } from '../src/agent/orchestrator.js';
import { OrderTool } from '../src/agent/order-tool.js';
import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { seedDemoOrders } from '../src/db/seed.js';
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

  it('persists and streams an answer with the retrieval source', async () => {
    const conversations = new ConversationRepository(database);
    const conversation = conversations.create('visitor-2');
    const retriever: RetrievalService = {
      search: async () => [{ chunkId: 'chunk-1', title: '退款说明', sourceLabel: '退款说明', content: '七日内可申请退款。', score: 0.92 }],
    };
    const model: ChatModel = {
      respond: async () => ({ type: 'answer', content: '您可在七日内申请退款。' }),
    };
    const orchestrator = new AgentOrchestrator({
      conversations,
      traces: new TraceRepository(database),
      handoffs: new HandoffService(database, conversations),
      retriever,
      model,
    });

    const events = await collect(orchestrator.respond({ conversationId: conversation.id, message: '怎么退款？' }));

    expect(events).toEqual([
      { type: 'token', text: '您可在七日内申请退款。' },
      { type: 'citation', sourceLabel: '退款说明' },
      { type: 'completed' },
    ]);
    expect(conversations.listMessages(conversation.id).at(-1)).toMatchObject({
      role: 'assistant',
      content: '您可在七日内申请退款。',
    });
  });

  it('validates a model order lookup and streams the final answer', async () => {
    seedDemoOrders(database);
    const conversations = new ConversationRepository(database);
    const conversation = conversations.create('visitor-3');
    const retriever: RetrievalService = {
      search: async () => [{ chunkId: 'c-1', title: '订单说明', sourceLabel: '订单说明', content: '可使用订单号查询状态。', score: 0.88 }],
    };
    const model: ChatModel = {
      respond: async (input) => input.toolResult
        ? { type: 'answer', content: `订单 ${input.toolResult.orderId} ${input.toolResult.status}。` }
        : { type: 'tool_call', name: 'query_order', arguments: { orderId: 'A1001' } },
    };
    const orchestrator = new AgentOrchestrator({
      conversations,
      traces: new TraceRepository(database),
      handoffs: new HandoffService(database, conversations),
      retriever,
      model,
      orderTool: new OrderTool(database),
    });

    const events = await collect(orchestrator.respond({ conversationId: conversation.id, message: '订单 A1001 到哪了？' }));

    expect(events).toEqual([
      { type: 'tool_call', name: 'query_order', status: 'succeeded' },
      { type: 'token', text: '订单 A1001 已发货。' },
      { type: 'citation', sourceLabel: '订单说明' },
      { type: 'completed' },
    ]);
  });
});
