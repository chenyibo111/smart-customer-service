import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminPage } from '../src/pages/AdminPage.js';

describe('AdminPage', () => {
  it('shows imported knowledge and a replay trace', async () => {
    const client = {
      listDocuments: async () => [{ id: 'doc-1', title: '退款说明', indexStatus: 'indexed' }],
      importDocument: async () => undefined,
      getReplay: async () => ({
        messages: [],
        toolCalls: [{ id: 'call-1', name: 'query_order', maskedArguments: '{"orderId":"A***1"}', status: 'succeeded' }],
      }),
    };
    render(<AdminPage client={client} />);

    expect(await screen.findByText('退款说明')).toBeInTheDocument();
    expect(await screen.findByText('query_order')).toBeInTheDocument();
  });
});
