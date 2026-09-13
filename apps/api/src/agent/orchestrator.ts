import { mayRunAgent } from '../domain/conversation-state.js';
import type { HandoffService } from '../domain/handoff-service.js';
import type { RetrievedChunk } from '../knowledge/retriever.js';
import type { ConversationRepository } from '../repositories/conversation-repository.js';
import type { TraceRepository } from '../repositories/trace-repository.js';

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

export class AgentOrchestrator {
  constructor(
    private readonly dependencies: {
      conversations: ConversationRepository;
      traces: TraceRepository;
      handoffs: HandoffService;
      retriever: RetrievalService;
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
    this.dependencies.traces.createRun({
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

    yield { type: 'failed', message: '智能客服模型尚未配置，已为你转接人工客服。' };
  }
}
