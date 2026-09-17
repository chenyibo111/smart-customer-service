import { mayRunAgent } from '../domain/conversation-state.js';
import type { HandoffService } from '../domain/handoff-service.js';
import type { RetrievedChunk } from '../knowledge/retriever.js';
import type { ConversationRepository } from '../repositories/conversation-repository.js';
import type { TraceRepository } from '../repositories/trace-repository.js';
import type { OrderTool } from './order-tool.js';

export type RetrievalService = {
  search(query: string, limit: number): Promise<RetrievedChunk[]>;
};

export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'citation'; sourceLabel: string }
  | { type: 'tool_call'; name: string; status: 'succeeded' | 'failed' }
  | { type: 'handoff'; reason: 'insufficient_knowledge' | 'customer_requested' | 'service_failure'; message: string }
  | { type: 'completed' }
  | { type: 'failed'; message: string };

export type ChatModel = {
  respond(input: {
    question: string;
    evidence: RetrievedChunk[];
    toolResult?: { orderId: string; status: string; summary: string };
  }): Promise<
    | { type: 'answer'; content: string }
    | { type: 'tool_call'; name: 'query_order'; arguments: unknown }
  >;
};

export function isExplicitHumanRequest(message: string): boolean {
  return /(转人工|人工客服|找客服|联系客服)/.test(message);
}

export class AgentOrchestrator {
  constructor(
    private readonly dependencies: {
      conversations: ConversationRepository;
      traces: TraceRepository;
      handoffs: HandoffService;
      retriever: RetrievalService;
      model?: ChatModel;
      orderTool?: OrderTool;
    },
  ) {}

  async *respond(input: { conversationId: string; message: string }): AsyncGenerator<AgentEvent> {
    const conversation = this.dependencies.conversations.getById(input.conversationId);
    if (!conversation) {
      yield { type: 'failed', message: '会话不存在，请刷新后重试。' };
      return;
    }
    if (!mayRunAgent(conversation.status)) {
      yield { type: 'failed', message: '该会话已由人工客服处理。' };
      return;
    }

    const message = this.dependencies.conversations.appendMessage({
      conversationId: conversation.id,
      role: 'customer',
      content: input.message,
    });
    if (isExplicitHumanRequest(input.message)) {
      this.dependencies.handoffs.requestHumanHandoff(conversation.id, 'customer_requested');
      yield {
        type: 'handoff',
        reason: 'customer_requested',
        message: '已为你转接人工客服。',
      };
      return;
    }
    const run = this.dependencies.traces.createRun({
      conversationId: conversation.id,
      triggerMessageId: message.id,
      model: 'deepseek-v4-flash',
    });
    const evidence = await this.dependencies.retriever.search(input.message, 3);

    if (evidence.length === 0) {
      this.dependencies.handoffs.requestHumanHandoff(conversation.id, 'insufficient_knowledge');
      yield {
        type: 'handoff',
        reason: 'insufficient_knowledge',
        message: '暂时没有找到可靠答案，已为你转接人工客服。',
      };
      return;
    }

    if (!this.dependencies.model) {
      this.dependencies.handoffs.requestHumanHandoff(conversation.id, 'service_failure');
      yield { type: 'handoff', reason: 'service_failure', message: '智能客服暂时不可用，已为你转接人工客服。' };
      return;
    }

    try {
      let response = await this.dependencies.model.respond({ question: input.message, evidence });
      if (response.type === 'tool_call') {
        if (!this.dependencies.orderTool) throw new Error('order tool unavailable');

        const result = this.dependencies.orderTool.queryOrder(response.arguments);
        this.dependencies.traces.recordToolCall({
          runId: run.id,
          name: response.name,
          maskedArguments: JSON.stringify({ orderId: `${result.orderId.slice(0, 1)}***${result.orderId.slice(-1)}` }),
          result: `${result.status}: ${result.summary}`,
          status: 'succeeded',
        });
        yield { type: 'tool_call', name: response.name, status: 'succeeded' };
        response = await this.dependencies.model.respond({ question: input.message, evidence, toolResult: result });
      }
      if (response.type !== 'answer') throw new Error('unexpected model response');

      this.dependencies.conversations.appendMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: response.content,
      });
      yield { type: 'token', text: response.content };
      for (const item of evidence) yield { type: 'citation', sourceLabel: item.sourceLabel };
      yield { type: 'completed' };
    } catch {
      this.dependencies.handoffs.requestHumanHandoff(conversation.id, 'service_failure');
      yield { type: 'handoff', reason: 'service_failure', message: '智能客服暂时不可用，已为你转接人工客服。' };
    }
  }
}
