import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ChatPage } from '../src/pages/ChatPage.js';

describe('ChatPage', () => {
  it('renders streamed answer text and source labels', async () => {
    const client = {
      createConversation: async () => ({ id: 'conversation-1' }),
      handoff: async () => ({ conversation: { status: 'waiting_human' } }),
      streamMessage: async function* () {
        yield { type: 'token' as const, text: '可在七日内退款。' };
        yield { type: 'citation' as const, sourceLabel: '退款说明' };
        yield { type: 'completed' as const };
      },
    };
    const user = userEvent.setup();
    render(<ChatPage client={client} />);

    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await user.type(screen.getByRole('textbox'), '怎么退款？');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('可在七日内退款。')).toBeInTheDocument();
    expect(screen.getByText('来源：退款说明')).toBeInTheDocument();
  });
});
