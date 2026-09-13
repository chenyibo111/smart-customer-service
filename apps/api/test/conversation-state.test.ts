import { beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { HandoffService } from '../src/domain/handoff-service.js';
import { mayRunAgent, transitionConversation } from '../src/domain/conversation-state.js';
import { ConversationRepository } from '../src/repositories/conversation-repository.js';

describe('conversation handoff state machine', () => {
  it('keeps the Agent blocked after a handoff has started', () => {
    expect(transitionConversation('waiting_human', 'agent_reply_requested')).toBe('waiting_human');
    expect(transitionConversation('human_active', 'agent_reply_requested')).toBe('human_active');
    expect(mayRunAgent('waiting_human')).toBe(false);
    expect(mayRunAgent('human_active')).toBe(false);
  });

  describe('HandoffService', () => {
    let database: AppDatabase;
    let conversations: ConversationRepository;

    beforeEach(() => {
      database = createDatabase(':memory:');
      migrate(database);
      conversations = new ConversationRepository(database);
    });

    it('creates an open ticket and transfers control to the human queue', () => {
      const conversation = conversations.create('visitor-1');
      const handoff = new HandoffService(database, conversations).requestHumanHandoff(
        conversation.id,
        'customer_requested',
      );

      expect(handoff.ticket.status).toBe('open');
      expect(handoff.conversation).toMatchObject({ status: 'waiting_human', controller: 'human' });
      expect(mayRunAgent(handoff.conversation.status)).toBe(false);
    });

    it('assigns a ticket to a staff member and keeps the Agent blocked', () => {
      const conversation = conversations.create('visitor-2');
      const service = new HandoffService(database, conversations);
      const handoff = service.requestHumanHandoff(conversation.id, 'insufficient_knowledge');

      const claimed = service.claimTicket(handoff.ticket.id, 'agent-demo');

      expect(claimed.ticket).toMatchObject({ status: 'claimed', claimedBy: 'agent-demo' });
      expect(claimed.conversation).toMatchObject({ status: 'human_active', controller: 'human' });
      expect(mayRunAgent(claimed.conversation.status)).toBe(false);
    });
  });
});
