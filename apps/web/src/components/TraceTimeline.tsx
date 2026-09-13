import type { Replay } from '../app/api.js';

export function TraceTimeline({ replay }: { replay: Replay | null }) {
  if (!replay) return <p className="empty-state">正在载入运行回放…</p>;
  return <section className="trace-timeline"><h2>运行回放</h2><h3>会话消息</h3>{replay.messages.length === 0 ? <p className="empty-state">该会话还没有消息记录。</p> : replay.messages.map((message) => <article className="trace-item" key={message.id}><strong>{message.role}</strong><span>{message.content}</span></article>)}<h3>工具调用</h3>{replay.toolCalls.length === 0 ? <p className="empty-state">该会话还没有工具调用记录。</p> : replay.toolCalls.map((call) => <article className="trace-item" key={call.id}><strong>{call.name}</strong><span>{call.status === 'succeeded' ? '成功' : '失败'}</span><code>{call.maskedArguments}</code></article>)}</section>;
}
