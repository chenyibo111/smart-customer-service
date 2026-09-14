import { AgentOrchestrator, type AgentEvent, type ChatModel, type RetrievalService } from '../agent/orchestrator.js';
import { OrderTool } from '../agent/order-tool.js';
import { createDatabase, type AppDatabase } from '../db/database.js';
import { migrate } from '../db/migrate.js';
import { seedDemoOrders } from '../db/seed.js';
import { HandoffService } from '../domain/handoff-service.js';
import type { EvaluationCase, EvaluationMode, EvaluationObservation, EvaluationRunDetail } from './contracts.js';
import { scoreEvaluationCase } from './scoring.js';
import { ConversationRepository } from '../repositories/conversation-repository.js';
import { EvaluationRepository } from '../repositories/evaluation-repository.js';
import { TraceRepository } from '../repositories/trace-repository.js';

type EvaluationAgentDependencies = {
  retriever: RetrievalService;
  model?: ChatModel;
  orderTool?: OrderTool;
};

export type EvaluationExecutionInput = { database: AppDatabase; caseRecord: EvaluationCase };
export type EvaluationDependencyFactory = (input: EvaluationExecutionInput) => Promise<EvaluationAgentDependencies> | EvaluationAgentDependencies;

async function collectEvents(stream: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function observeEvents(events: AgentEvent[]): EvaluationObservation {
  let answerContent: string | null = null;
  let handoffReason: EvaluationObservation['handoffReason'] = null;
  let failureReason: string | null = null;
  const citationLabels: string[] = [];
  const toolNames: string[] = [];

  for (const event of events) {
    if (event.type === 'token') answerContent = `${answerContent ?? ''}${event.text}`;
    if (event.type === 'citation') citationLabels.push(event.sourceLabel);
    if (event.type === 'tool_call') toolNames.push(event.name);
    if (event.type === 'handoff') handoffReason = event.reason;
    if (event.type === 'failed') failureReason = '智能客服执行失败。';
  }

  if (handoffReason) {
    return { outcome: 'handoff', citationLabels: [...new Set(citationLabels)], toolNames: [...new Set(toolNames)], handoffReason, answerContent, failureReason: null };
  }
  if (answerContent !== null) {
    return { outcome: 'answer', citationLabels: [...new Set(citationLabels)], toolNames: [...new Set(toolNames)], handoffReason: null, answerContent, failureReason: null };
  }
  return {
    outcome: 'failed',
    citationLabels: [...new Set(citationLabels)],
    toolNames: [...new Set(toolNames)],
    handoffReason: null,
    answerContent: null,
    failureReason: failureReason ?? '评估未产生可观察结果。',
  };
}

export class EvaluationRunner {
  private readonly createOfflineDependencies: EvaluationDependencyFactory;

  constructor(
    private readonly input: {
      repository: EvaluationRepository;
      createOfflineDependencies?: EvaluationDependencyFactory;
      createRealDependencies?: EvaluationDependencyFactory;
    },
  ) {
    this.createOfflineDependencies = input.createOfflineDependencies ?? (async ({ caseRecord }) => EvaluationRunner.createOfflineDependencies({ caseRecord }));
  }

  static createOfflineDependencies(input: Pick<EvaluationExecutionInput, 'caseRecord'>): EvaluationAgentDependencies {
    const sourceLabel = input.caseRecord.id === 'refund-answer' ? '退款说明' : '订单说明';
    const retriever: RetrievalService = {
      search: async () => {
        if (input.caseRecord.id === 'refund-answer') {
          return [{ chunkId: 'refund-policy', title: sourceLabel, sourceLabel, content: '七日内可申请退款。', score: 1 }];
        }
        if (input.caseRecord.id === 'valid-order-a1001' || input.caseRecord.id === 'malformed-order') {
          return [{ chunkId: 'order-guide', title: sourceLabel, sourceLabel, content: '可使用订单号查询状态。', score: 1 }];
        }
        return [];
      },
    };
    const model: ChatModel = {
      respond: async (request) => {
        if (input.caseRecord.id === 'valid-order-a1001') {
          if (!request.toolResult) return { type: 'tool_call', name: 'query_order', arguments: { orderId: 'A1001' } };
          return { type: 'answer', content: `订单 ${request.toolResult.orderId} ${request.toolResult.status}。` };
        }
        if (input.caseRecord.id === 'malformed-order') return { type: 'tool_call', name: 'query_order', arguments: { orderId: 'A12' } };
        return { type: 'answer', content: '您可在七日内申请退款。' };
      },
    };
    return { retriever, model };
  }

  async run(mode: EvaluationMode): Promise<EvaluationRunDetail> {
    const run = this.input.repository.createRun(mode);
    const startedAt = Date.now();
    const cases = this.input.repository.listCases();
    let passCount = 0;
    const factory = mode === 'offline'
      ? this.createOfflineDependencies
      : this.input.createRealDependencies ?? (async () => { throw new Error('real evaluation is unavailable'); });

    for (const caseRecord of cases) {
      const database = createDatabase(':memory:');
      const caseStartedAt = Date.now();
      try {
        migrate(database);
        seedDemoOrders(database);
        const conversations = new ConversationRepository(database);
        const dependencies = await factory({ database, caseRecord });
        const conversation = conversations.create(`evaluation:${caseRecord.id}`);
        const orchestrator = new AgentOrchestrator({
          conversations,
          traces: new TraceRepository(database),
          handoffs: new HandoffService(database, conversations),
          retriever: dependencies.retriever,
          model: dependencies.model,
          orderTool: dependencies.orderTool ?? new OrderTool(database),
        });
        const observation = observeEvents(await collectEvents(orchestrator.respond({ conversationId: conversation.id, message: caseRecord.question })));
        const score = scoreEvaluationCase(caseRecord, observation);
        this.input.repository.recordResult({
          ...observation,
          ...score,
          runId: run.id,
          caseId: caseRecord.id,
          elapsedMs: Date.now() - caseStartedAt,
        });
        if (score.passed) passCount += 1;
      } catch {
        this.input.repository.recordResult({
          runId: run.id,
          caseId: caseRecord.id,
          outcome: 'failed',
          citationLabels: [],
          toolNames: [],
          handoffReason: null,
          answerContent: null,
          elapsedMs: Date.now() - caseStartedAt,
          passed: false,
          failureReason: '评估执行失败。',
        });
      } finally {
        database.close();
      }
    }

    this.input.repository.completeRun({
      id: run.id,
      totalCount: cases.length,
      passCount,
      elapsedMs: Date.now() - startedAt,
    });
    return this.input.repository.getRun(run.id)!;
  }
}
