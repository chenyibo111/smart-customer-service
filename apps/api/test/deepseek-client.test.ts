import { describe, expect, it } from 'vitest';

import { DeepSeekClient } from '../src/agent/deepseek-client.js';

describe('DeepSeekClient', () => {
  it('maps an OpenAI-compatible completion into an evidence-backed answer', async () => {
    const client = new DeepSeekClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.example',
      model: 'deepseek-v4-flash',
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: '您可在七日内申请退款。' } }],
      }), { status: 200 }),
    });

    await expect(client.respond({
      question: '怎么退款？',
      evidence: [{ chunkId: 'c-1', title: '退款说明', sourceLabel: '退款说明', content: '七日内可申请退款。', score: 0.91 }],
    })).resolves.toEqual({ type: 'answer', content: '您可在七日内申请退款。' });
  });

  it('maps an OpenAI-compatible function call into a validated tool request', async () => {
    const client = new DeepSeekClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.example',
      model: 'deepseek-v4-flash',
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { tool_calls: [{ function: { name: 'query_order', arguments: '{"orderId":"A1001"}' } }] } }],
      }), { status: 200 }),
    });

    await expect(client.respond({
      question: '订单 A1001 到哪了？',
      evidence: [{ chunkId: 'c-1', title: '订单说明', sourceLabel: '订单说明', content: '可使用订单号查询状态。', score: 0.86 }],
    })).resolves.toEqual({ type: 'tool_call', name: 'query_order', arguments: { orderId: 'A1001' } });
  });
});
