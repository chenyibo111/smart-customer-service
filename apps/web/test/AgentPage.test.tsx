import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AgentPage } from '../src/pages/AgentPage.js';

describe('AgentPage', () => {
  it('lets a staff user claim a waiting ticket', async () => {
    const client = {
      listTickets: async () => [{ id: 'ticket-1', reason: 'customer_requested', status: 'open' }],
      claimTicket: async () => ({ conversation: { status: 'human_active' }, ticket: { id: 'ticket-1', status: 'claimed' } }),
      sendMessage: async () => ({ id: 'message-1' }),
      closeTicket: async () => ({ conversation: { status: 'resolved' }, ticket: { status: 'closed' } }),
    };
    const user = userEvent.setup();
    render(<AgentPage client={client} />);

    await user.click(await screen.findByRole('button', { name: '接管' }));

    expect(screen.getByRole('heading', { name: '人工处理中' })).toBeInTheDocument();
  });
});
