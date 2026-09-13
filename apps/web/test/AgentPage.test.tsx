import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AgentPage } from '../src/pages/AgentPage.js';

describe('AgentPage', () => {
  it('lets a staff user claim a waiting ticket', async () => {
    const client = {
      listTickets: async () => [{ id: 'ticket-1', reason: 'customer_requested', status: 'open' }],
      claimTicket: async () => ({ conversation: { status: 'human_active' }, ticket: { id: 'ticket-1', status: 'claimed' } }),
      getTicketContext: async () => ({
        ticket: { id: 'ticket-1', conversationId: 'conversation-1', status: 'claimed' },
        conversation: { id: 'conversation-1', status: 'human_active' },
        messages: [{ id: 'message-1', role: 'customer', content: '我的退款什么时候到账？' }],
      }),
      sendMessage: async (_ticketId: string, content: string) => ({ id: 'message-2', role: 'agent', content }),
      closeTicket: async () => ({ conversation: { status: 'resolved' }, ticket: { status: 'closed' } }),
    };
    const user = userEvent.setup();
    render(<AgentPage client={client} />);

    await user.click(await screen.findByRole('button', { name: '接管' }));

    expect(screen.getByRole('heading', { name: '人工处理中' })).toBeInTheDocument();
    expect(await screen.findByText('我的退款什么时候到账？')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: '人工回复' }), '退款预计 1 到 3 个工作日到账。');
    await user.click(screen.getByRole('button', { name: '发送回复' }));
    expect(await screen.findByText('退款预计 1 到 3 个工作日到账。')).toBeInTheDocument();
  });
});
