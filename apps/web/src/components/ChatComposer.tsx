import { useState } from 'react';

export function ChatComposer({ disabled, onSend }: { disabled: boolean; onSend(content: string): Promise<void> }) {
  const [content, setContent] = useState('');

  return (
    <form className="chat-composer" onSubmit={(event) => {
      event.preventDefault();
      const message = content.trim();
      if (!message || disabled) return;
      setContent('');
      void onSend(message);
    }}>
      <label className="sr-only" htmlFor="customer-message">输入问题</label>
      <textarea id="customer-message" value={content} disabled={disabled} onChange={(event) => setContent(event.target.value)} placeholder="例如：订单 A1001 到哪了？" />
      <button type="submit" disabled={disabled || !content.trim()}>发送</button>
    </form>
  );
}
