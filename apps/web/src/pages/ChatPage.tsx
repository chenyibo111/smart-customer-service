import { useEffect, useMemo, useState } from 'react';
import { SpinnerIcon } from '@chenyibo111/icons';
import { Alert, Button } from '@chenyibo111/ui';

import { customerApi, type CustomerApi } from '../app/api.js';
import { ChatComposer } from '../components/ChatComposer.js';
import { MessageList, type ChatMessage } from '../components/MessageList.js';

function visitorId(): string {
  const stored = localStorage.getItem('smart-cs-visitor-id');
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem('smart-cs-visitor-id', id);
  return id;
}

export function ChatPage({ client = customerApi }: { client?: CustomerApi }) {
  const [conversationId, setConversationId] = useState<string | null>(() => sessionStorage.getItem('smart-cs-conversation-id'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [notice, setNotice] = useState('');
  const canSend = useMemo(() => !streaming && !handoff && Boolean(conversationId), [conversationId, handoff, streaming]);

  useEffect(() => {
    if (conversationId) return;
    void client.createConversation(visitorId()).then((conversation) => {
      sessionStorage.setItem('smart-cs-conversation-id', conversation.id);
      setConversationId(conversation.id);
    }).catch(() => setNotice('暂时无法创建会话，请刷新页面重试。'));
  }, [client, conversationId]);

  const requestHandoff = async () => {
    if (!conversationId || handoff) return;
    try {
      await client.handoff(conversationId);
      setHandoff(true);
      setNotice('已转人工，正在等待客服接管。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '转人工失败，请稍后重试。');
    }
  };

  const send = async (content: string) => {
    if (!conversationId || !canSend) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'customer', content }]);
    setStreaming(true);
    try {
      for await (const event of client.streamMessage(conversationId, content)) {
        if (event.type === 'token') {
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: event.text }]);
        } else if (event.type === 'citation') {
          setMessages((current) => {
            const last = current.at(-1);
            if (!last || last.role !== 'assistant') return current;
            return [...current.slice(0, -1), { ...last, citations: [...(last.citations ?? []), event.sourceLabel] }];
          });
        } else if (event.type === 'handoff') {
          setHandoff(true);
          setNotice(event.message);
        } else if (event.type === 'failed') {
          setNotice(event.message);
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '暂时无法处理，请转人工。');
    } finally {
      setStreaming(false);
    }
  };

  return (
    <main className="workspace chat-workspace">
      <header className="workspace-header"><span className="eyebrow">智能客服演示</span><h1>有什么可以帮你？</h1><p>基于本地知识库回答；不确定时会为你转接人工。</p></header>
      <MessageList messages={messages} />
      {notice && <Alert className="notice" variant="info" role="status">{notice}</Alert>}
      <div className="chat-actions"><Button type="button" variant="secondary" onClick={() => void requestHandoff()} disabled={!conversationId || handoff}>转人工</Button><span className="chat-status">{streaming && <SpinnerIcon aria-hidden="true" size={16} />}{handoff ? '人工队列中' : streaming ? '正在思考…' : 'AI 在线'}</span></div>
      <ChatComposer disabled={!canSend} onSend={send} />
    </main>
  );
}
