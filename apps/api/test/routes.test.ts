import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { seedEvaluationCases } from '../src/db/seed.js';
import { EvaluationRunner } from '../src/evaluations/runner.js';
import { Retriever } from '../src/knowledge/retriever.js';
import { EvaluationRepository } from '../src/repositories/evaluation-repository.js';
import { KnowledgeRepository } from '../src/repositories/knowledge-repository.js';

describe('HTTP API', () => {
  let database: AppDatabase;

  beforeEach(() => {
    database = createDatabase(':memory:');
    migrate(database);
  });

  afterEach(() => database.close());

  it('creates a conversation and safely hands it to a human', async () => {
    const app = buildApp({ database });
    const created = await app.inject({ method: 'POST', url: '/api/conversations', payload: { visitorId: 'visitor-1' } });
    const conversationId = created.json().conversation.id as string;

    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/handoff`,
      payload: { reason: 'customer_requested' },
    });

    expect(created.statusCode).toBe(201);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      conversation: { id: conversationId, status: 'waiting_human', controller: 'human' },
      ticket: { status: 'open', reason: 'customer_requested' },
    });
    await app.close();
  });

  it('lets a staff member claim a ticket, reply, and resolve it', async () => {
    const app = buildApp({ database });
    const created = await app.inject({ method: 'POST', url: '/api/conversations', payload: { visitorId: 'visitor-2' } });
    const conversationId = created.json().conversation.id as string;
    const handoff = await app.inject({
      method: 'POST', url: `/api/conversations/${conversationId}/handoff`,
      payload: { reason: 'customer_requested' },
    });
    const ticketId = handoff.json().ticket.id as string;

    const queue = await app.inject({ method: 'GET', url: '/api/agent/tickets' });
    const claimed = await app.inject({ method: 'POST', url: `/api/agent/tickets/${ticketId}/claim`, payload: { agentId: 'agent-demo' } });
    const reply = await app.inject({
      method: 'POST',
      url: `/api/agent/tickets/${ticketId}/messages`,
      payload: { content: '您好，我来协助处理。' },
    });
    const closed = await app.inject({ method: 'POST', url: `/api/agent/tickets/${ticketId}/close` });

    expect(queue.json().tickets).toEqual([expect.objectContaining({ id: ticketId, status: 'open' })]);
    expect(claimed.json()).toMatchObject({ conversation: { status: 'human_active' }, ticket: { claimedBy: 'agent-demo' } });
    expect(reply.statusCode).toBe(201);
    expect(reply.json().message).toMatchObject({ role: 'agent', content: '您好，我来协助处理。' });
    expect(closed.json()).toMatchObject({ conversation: { status: 'resolved' }, ticket: { status: 'closed' } });
    await app.close();
  });

  it('serializes agent output as named SSE events', async () => {
    const agent = {
      async *respond() {
        yield { type: 'token' as const, text: '可在七日内申请退款。' };
        yield { type: 'citation' as const, sourceLabel: '退款说明' };
        yield { type: 'completed' as const };
      },
    };
    const app = buildApp({ database, agent });
    const created = await app.inject({ method: 'POST', url: '/api/conversations', payload: { visitorId: 'visitor-3' } });
    const conversationId = created.json().conversation.id as string;

    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages`,
      payload: { content: '怎么退款？' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('event: token\ndata: {"type":"token","text":"可在七日内申请退款。"}');
    expect(response.body).toContain('event: citation\ndata: {"type":"citation","sourceLabel":"退款说明"}');
    await app.close();
  });

  it('indexes an admin document and exposes a safe conversation replay', async () => {
    const indexer = new Retriever(
      new KnowledgeRepository(database),
      { embed: async (texts) => texts.map(() => [1, 0]) },
      0.5,
    );
    const app = buildApp({
      database,
      indexer,
    });
    const created = await app.inject({ method: 'POST', url: '/api/conversations', payload: { visitorId: 'visitor-4' } });
    const conversationId = created.json().conversation.id as string;

    const imported = await app.inject({
      method: 'POST',
      url: '/api/admin/documents',
      payload: { title: '退款说明', markdown: '# 退款\n七日内可申请退款。' },
    });
    const documents = await app.inject({ method: 'GET', url: '/api/admin/documents' });
    const replay = await app.inject({ method: 'GET', url: `/api/admin/conversations/${conversationId}/replay` });

    expect(imported.statusCode).toBe(201);
    expect(documents.json().documents).toEqual([expect.objectContaining({ title: '退款说明', indexStatus: 'indexed' })]);
    expect(replay.json()).toEqual({ messages: [], toolCalls: [] });
    await app.close();
  });

  it('returns the selected ticket context and lists real conversations for replay', async () => {
    const app = buildApp({ database });
    const created = await app.inject({ method: 'POST', url: '/api/conversations', payload: { visitorId: 'visitor-context' } });
    const conversationId = created.json().conversation.id as string;
    const handoff = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/handoff`,
      payload: { reason: 'customer_requested' },
    });
    const ticketId = handoff.json().ticket.id as string;
    await app.inject({ method: 'POST', url: `/api/agent/tickets/${ticketId}/claim`, payload: { agentId: 'agent-demo' } });
    await app.inject({
      method: 'POST',
      url: `/api/agent/tickets/${ticketId}/messages`,
      payload: { content: '您好，我已看到您的问题。' },
    });

    const context = await app.inject({ method: 'GET', url: `/api/agent/tickets/${ticketId}/context` });
    const conversations = await app.inject({ method: 'GET', url: '/api/admin/conversations' });

    expect(context.statusCode).toBe(200);
    expect(context.json()).toMatchObject({
      ticket: { id: ticketId, conversationId },
      conversation: { id: conversationId, status: 'human_active' },
      messages: [expect.objectContaining({ role: 'agent', content: '您好，我已看到您的问题。' })],
    });
    expect(conversations.json().conversations).toEqual([
      expect.objectContaining({ id: conversationId, visitorId: 'visitor-context', status: 'human_active' }),
    ]);
    await app.close();
  });

  it('runs the offline evaluation batch and returns persisted detail', async () => {
    seedEvaluationCases(database);
    const app = buildApp({
      database,
      evaluations: new EvaluationRunner({ repository: new EvaluationRepository(database) }),
    });

    const cases = await app.inject({ method: 'GET', url: '/api/admin/evaluations/cases' });
    const started = await app.inject({ method: 'POST', url: '/api/admin/evaluations/runs', payload: { mode: 'offline' } });
    const runId = started.json().run.id as string;
    const history = await app.inject({ method: 'GET', url: '/api/admin/evaluations/runs' });
    const detail = await app.inject({ method: 'GET', url: `/api/admin/evaluations/runs/${runId}` });

    expect(cases.json().cases).toHaveLength(6);
    expect(started.statusCode).toBe(201);
    expect(started.json()).toMatchObject({ run: { mode: 'offline', totalCount: 6, passCount: 6 } });
    expect(history.json().runs).toEqual([expect.objectContaining({ id: runId, passCount: 6 })]);
    expect(detail.json().results).toEqual(expect.arrayContaining([
      expect.objectContaining({ caseId: 'valid-order-a1001', toolNames: ['query_order'], passed: true }),
    ]));
    await app.close();
  });

  it('rejects an unsupported evaluation mode and reports a missing run safely', async () => {
    seedEvaluationCases(database);
    const app = buildApp({
      database,
      evaluations: new EvaluationRunner({ repository: new EvaluationRepository(database) }),
    });

    const invalid = await app.inject({ method: 'POST', url: '/api/admin/evaluations/runs', payload: { mode: 'preview' } });
    const missing = await app.inject({ method: 'GET', url: '/api/admin/evaluations/runs/missing-run' });

    expect(invalid).toMatchObject({ statusCode: 400 });
    expect(invalid.json()).toEqual({ code: 'INVALID_REQUEST', message: '评估模式无效。' });
    expect(missing).toMatchObject({ statusCode: 404 });
    expect(missing.json()).toEqual({ code: 'NOT_FOUND', message: '评估运行不存在。' });
    await app.close();
  });
});
