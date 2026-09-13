import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';
import type { MessageRecord } from './conversation-repository.js';

export type ToolCallRecord = {
  id: string;
  runId: string;
  name: string;
  maskedArguments: string;
  result: string;
  status: 'succeeded' | 'failed';
  createdAt: string;
};

export type AgentRunRecord = {
  id: string;
  conversationId: string;
  triggerMessageId: string;
  model: string;
  status: 'running' | 'completed' | 'failed';
  createdAt: string;
};

type ToolCallRow = {
  id: string;
  run_id: string;
  name: string;
  masked_arguments: string;
  result: string;
  status: ToolCallRecord['status'];
  created_at: string;
};

const toToolCall = (row: ToolCallRow): ToolCallRecord => ({
  id: row.id,
  runId: row.run_id,
  name: row.name,
  maskedArguments: row.masked_arguments,
  result: row.result,
  status: row.status,
  createdAt: row.created_at,
});

export class TraceRepository {
  constructor(private readonly database: AppDatabase) {}

  createRun(input: Omit<AgentRunRecord, 'id' | 'status' | 'createdAt'>): AgentRunRecord {
    const run: AgentRunRecord = { id: randomUUID(), ...input, status: 'running', createdAt: new Date().toISOString() };
    this.database
      .prepare('INSERT INTO agent_runs (id, conversation_id, trigger_message_id, model, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(run.id, run.conversationId, run.triggerMessageId, run.model, run.status, run.createdAt);
    return run;
  }

  recordToolCall(input: Omit<ToolCallRecord, 'id' | 'createdAt'>): ToolCallRecord {
    const call: ToolCallRecord = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
    this.database
      .prepare('INSERT INTO tool_calls (id, run_id, name, masked_arguments, result, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(call.id, call.runId, call.name, call.maskedArguments, call.result, call.status, call.createdAt);
    return call;
  }

  getReplay(conversationId: string): { messages: MessageRecord[]; toolCalls: ToolCallRecord[] } {
    const messages = this.database
      .prepare('SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at')
      .all(conversationId) as Array<{ id: string; conversation_id: string; role: MessageRecord['role']; content: string; created_at: string }>;
    const toolCalls = this.database
      .prepare('SELECT tc.* FROM tool_calls tc JOIN agent_runs ar ON ar.id = tc.run_id WHERE ar.conversation_id = ? ORDER BY tc.created_at')
      .all(conversationId) as ToolCallRow[];

    return {
      messages: messages.map((message) => ({
        id: message.id,
        conversationId: message.conversation_id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
      toolCalls: toolCalls.map(toToolCall),
    };
  }
}
