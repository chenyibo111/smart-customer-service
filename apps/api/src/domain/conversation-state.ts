import type { ConversationRecord } from '../repositories/conversation-repository.js';

export type ConversationEvent =
  | 'customer_message_received'
  | 'assistant_reply_completed'
  | 'handoff_requested'
  | 'ticket_claimed'
  | 'ticket_closed'
  | 'agent_reply_requested';

export function mayRunAgent(status: ConversationRecord['status']): boolean {
  return status !== 'waiting_human' && status !== 'human_active' && status !== 'resolved';
}

export function transitionConversation(
  current: ConversationRecord['status'],
  event: ConversationEvent,
): ConversationRecord['status'] {
  if (event === 'agent_reply_requested' && !mayRunAgent(current)) return current;
  if (event === 'customer_message_received' && mayRunAgent(current)) return 'ai_processing';
  if (event === 'assistant_reply_completed' && current === 'ai_processing') return 'ai_replied';
  if (event === 'handoff_requested' && current !== 'resolved') return 'waiting_human';
  if (event === 'ticket_claimed' && current === 'waiting_human') return 'human_active';
  if (event === 'ticket_closed' && current === 'human_active') return 'resolved';
  return current;
}
