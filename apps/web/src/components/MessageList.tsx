export type ChatMessage = { id: string; role: 'customer' | 'assistant' | 'agent' | 'system'; content: string; citations?: string[] };

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <section className="message-list" aria-live="polite">
      {messages.length === 0 && <p className="empty-state">你好，我可以解答退款、发货和演示订单状态问题。</p>}
      {messages.map((message) => (
        <article className={`message message-${message.role}`} key={message.id}>
          <span className="message-role">{message.role === 'customer' ? '你' : message.role === 'assistant' ? '智能客服' : message.role === 'agent' ? '人工客服' : '系统'}</span>
          <p>{message.content}</p>
          {message.citations?.map((source) => <span className="citation" key={source}>来源：{source}</span>)}
        </article>
      ))}
    </section>
  );
}
