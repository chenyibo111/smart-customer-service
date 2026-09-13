export type AgentStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'citation'; sourceLabel: string }
  | { type: 'tool_call'; name: string; status: 'succeeded' | 'failed' }
  | { type: 'handoff'; reason: string; message: string }
  | { type: 'completed' }
  | { type: 'failed'; message: string };

export async function* readSse(response: Response): AsyncGenerator<AgentStreamEvent> {
  if (!response.ok || !response.body) throw new Error('智能客服暂时不可用，请转人工处理。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffered += decoder.decode(chunk.value, { stream: true });
    const frames = buffered.split('\n\n');
    buffered = frames.pop() ?? '';
    for (const frame of frames) {
      const data = frame.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
      if (data) yield JSON.parse(data) as AgentStreamEvent;
    }
  }
}
