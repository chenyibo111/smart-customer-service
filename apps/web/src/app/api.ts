import { readSse, type AgentStreamEvent } from './events.js';

export type Conversation = { id: string; visitorId?: string; status?: string; controller?: string };
export type ConversationMessage = { id: string; role: 'customer' | 'assistant' | 'agent' | 'system'; content: string };
export type CustomerApi = {
  createConversation(visitorId: string): Promise<Conversation>;
  streamMessage(conversationId: string, content: string): AsyncIterable<AgentStreamEvent>;
  handoff(conversationId: string): Promise<{ conversation: Conversation }>;
};

async function jsonRequest(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const customerApi: CustomerApi = {
  async createConversation(visitorId) {
    const response = await jsonRequest('/api/conversations', { visitorId });
    if (!response.ok) throw new Error('无法创建会话。');
    return (await response.json() as { conversation: Conversation }).conversation;
  },
  async *streamMessage(conversationId, content) {
    yield* readSse(await jsonRequest(`/api/conversations/${conversationId}/messages`, { content }));
  },
  async handoff(conversationId) {
    const response = await jsonRequest(`/api/conversations/${conversationId}/handoff`, { reason: 'customer_requested' });
    if (!response.ok) throw new Error('转人工失败，请稍后重试。');
    return await response.json() as { conversation: Conversation };
  },
};

export type Ticket = { id: string; reason?: string; status: string; claimedBy?: string | null };
export type TicketContext = { ticket: Ticket & { conversationId: string }; conversation: Conversation; messages: ConversationMessage[] };
export type StaffApi = {
  listTickets(): Promise<Ticket[]>;
  claimTicket(ticketId: string): Promise<{ conversation: Conversation; ticket: Ticket }>;
  getTicketContext(ticketId: string): Promise<TicketContext>;
  sendMessage(ticketId: string, content: string): Promise<ConversationMessage>;
  closeTicket(ticketId: string): Promise<{ conversation: Conversation; ticket: Ticket }>;
};

export const staffApi: StaffApi = {
  async listTickets() {
    const response = await fetch('/api/agent/tickets');
    if (!response.ok) throw new Error('无法加载工单。');
    return (await response.json() as { tickets: Ticket[] }).tickets;
  },
  async claimTicket(ticketId) {
    const response = await jsonRequest(`/api/agent/tickets/${ticketId}/claim`, { agentId: 'agent-demo' });
    if (!response.ok) throw new Error('工单无法接管。');
    return await response.json() as { conversation: Conversation; ticket: Ticket };
  },
  async getTicketContext(ticketId) {
    const response = await fetch(`/api/agent/tickets/${ticketId}/context`);
    if (!response.ok) throw new Error('无法加载会话上下文。');
    return await response.json() as TicketContext;
  },
  async sendMessage(ticketId, content) {
    const response = await jsonRequest(`/api/agent/tickets/${ticketId}/messages`, { content });
    if (!response.ok) throw new Error('发送失败。');
    return (await response.json() as { message: ConversationMessage }).message;
  },
  async closeTicket(ticketId) {
    const response = await jsonRequest(`/api/agent/tickets/${ticketId}/close`);
    if (!response.ok) throw new Error('工单无法关闭。');
    return await response.json() as { conversation: Conversation; ticket: Ticket };
  },
};

export type KnowledgeDocument = { id: string; title: string; indexStatus: string };
export type Replay = { messages: ConversationMessage[]; toolCalls: Array<{ id: string; name: string; maskedArguments: string; status: string }> };
export type EvaluationCase = {
  id: string;
  name: string;
  question: string;
  expectedOutcome: 'answer' | 'handoff';
  expectedSourceLabel: string | null;
  expectedToolName: string | null;
  expectedHandoffReason: string | null;
};
export type EvaluationRun = {
  id: string;
  mode: 'offline' | 'real';
  status: 'running' | 'completed';
  startedAt: string;
  completedAt: string | null;
  totalCount: number;
  passCount: number;
  elapsedMs: number | null;
};
export type EvaluationResult = EvaluationCase & {
  id: string;
  runId: string;
  caseId: string;
  outcome: 'answer' | 'handoff' | 'failed';
  citationLabels: string[];
  toolNames: string[];
  handoffReason: string | null;
  answerContent: string | null;
  elapsedMs: number;
  passed: boolean;
  failureReason: string | null;
  createdAt: string;
};
export type EvaluationRunDetail = { run: EvaluationRun; results: EvaluationResult[] };
export type AdminApi = {
  listDocuments(): Promise<KnowledgeDocument[]>;
  listConversations(): Promise<Conversation[]>;
  importDocument(input: { title: string; markdown: string }): Promise<void>;
  getReplay(conversationId: string): Promise<Replay>;
  listEvaluationCases(): Promise<EvaluationCase[]>;
  runEvaluation(mode: 'offline' | 'real'): Promise<EvaluationRunDetail>;
  listEvaluationRuns(): Promise<EvaluationRun[]>;
  getEvaluationRun(runId: string): Promise<EvaluationRunDetail>;
};

export const adminApi: AdminApi = {
  async listDocuments() {
    const response = await fetch('/api/admin/documents');
    if (!response.ok) throw new Error('无法加载知识库。');
    return (await response.json() as { documents: KnowledgeDocument[] }).documents;
  },
  async importDocument(input) {
    const response = await jsonRequest('/api/admin/documents', input);
    if (!response.ok) throw new Error('知识导入失败。');
  },
  async listConversations() {
    const response = await fetch('/api/admin/conversations');
    if (!response.ok) throw new Error('无法加载会话列表。');
    return (await response.json() as { conversations: Conversation[] }).conversations;
  },
  async getReplay(conversationId) {
    const response = await fetch(`/api/admin/conversations/${conversationId}/replay`);
    if (!response.ok) throw new Error('无法加载回放。');
    return await response.json() as Replay;
  },
  async listEvaluationCases() {
    const response = await fetch('/api/admin/evaluations/cases');
    if (!response.ok) throw new Error('无法加载评估用例。');
    return (await response.json() as { cases: EvaluationCase[] }).cases;
  },
  async runEvaluation(mode) {
    const response = await jsonRequest('/api/admin/evaluations/runs', { mode });
    if (!response.ok) throw new Error('评估运行失败。');
    return await response.json() as EvaluationRunDetail;
  },
  async listEvaluationRuns() {
    const response = await fetch('/api/admin/evaluations/runs');
    if (!response.ok) throw new Error('无法加载评估历史。');
    return (await response.json() as { runs: EvaluationRun[] }).runs;
  },
  async getEvaluationRun(runId) {
    const response = await fetch(`/api/admin/evaluations/runs/${runId}`);
    if (!response.ok) throw new Error('无法加载评估结果。');
    return await response.json() as EvaluationRunDetail;
  },
};
