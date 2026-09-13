import type { ChatModel } from './orchestrator.js';

type FetchImplementation = typeof fetch;

export class DeepSeekClient implements ChatModel {
  private readonly fetchImpl: FetchImplementation;

  constructor(
    private readonly config: {
      apiKey: string;
      baseUrl: string;
      model: string;
      fetchImpl?: FetchImplementation;
    },
  ) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async respond(input: Parameters<ChatModel['respond']>[0]): ReturnType<ChatModel['respond']> {
    const response = await this.fetchImpl(new URL('chat/completions', `${this.config.baseUrl.replace(/\/$/, '')}/`).toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: '你是客服助手。只根据提供的知识来源回答；信息不足时说明无法确认。不要编造业务规则。',
          },
          {
            role: 'user',
            content: `用户问题：${input.question}\n\n知识来源：\n${input.evidence.map((item) => `【${item.sourceLabel}】${item.content}`).join('\n')}${input.toolResult ? `\n\n订单查询结果：${JSON.stringify(input.toolResult)}` : ''}`,
          },
        ],
        tools: input.toolResult ? undefined : [
          {
            type: 'function',
            function: {
              name: 'query_order',
              description: '根据订单号查询演示订单状态。仅当用户提供订单号时调用。',
              parameters: {
                type: 'object',
                properties: { orderId: { type: 'string', description: '形如 A1001 的订单号' } },
                required: ['orderId'],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek request failed with status ${response.status}`);
    const body = await response.json() as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
    };
    const message = body.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0]?.function;
    if (toolCall?.name === 'query_order' && toolCall.arguments) {
      return { type: 'tool_call', name: 'query_order', arguments: JSON.parse(toolCall.arguments) };
    }
    const content = message?.content?.trim();
    if (!content) throw new Error('DeepSeek response contained no message content');
    return { type: 'answer', content };
  }
}
