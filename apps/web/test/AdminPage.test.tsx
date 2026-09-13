import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminPage } from '../src/pages/AdminPage.js';

describe('AdminPage', () => {
  it('shows imported knowledge and a replay trace', async () => {
    const client = {
      listDocuments: async () => [{ id: 'doc-1', title: '退款说明', indexStatus: 'indexed' }],
      listConversations: async () => [{ id: 'conversation-7', visitorId: '访客 7', status: 'resolved' }],
      importDocument: async () => undefined,
      getReplay: async () => ({
        messages: [{ id: 'message-7', role: 'customer', content: '请查询订单 A1001。' }],
        toolCalls: [{ id: 'call-1', name: 'query_order', maskedArguments: '{"orderId":"A***1"}', status: 'succeeded' }],
      }),
    };
    render(<AdminPage client={client} />);

    expect(await screen.findByText('退款说明')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '查看访客 7 的会话' })).toBeInTheDocument();
    expect(screen.getByText('请查询订单 A1001。')).toBeInTheDocument();
    expect(await screen.findByText('query_order')).toBeInTheDocument();
  });
});
