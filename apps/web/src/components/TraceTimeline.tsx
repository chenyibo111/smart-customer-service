import { Card, CardContent, Empty } from '@chenyibo111/ui';
import type { Replay } from '../app/api.js';

export function TraceTimeline({ replay }: { replay: Replay | null }) {
  if (!replay) return <Empty title="正在载入运行回放…" />;
  return <section className="trace-timeline"><h2>运行回放</h2><h3>会话消息</h3>{replay.messages.length === 0 ? <Empty title="该会话还没有消息记录。" /> : replay.messages.map((message) => <Card className="trace-item" key={message.id}><CardContent className="trace-content"><strong>{message.role}</strong><span>{message.content}</span></CardContent></Card>)}<h3>工具调用</h3>{replay.toolCalls.length === 0 ? <Empty title="该会话还没有工具调用记录。" /> : replay.toolCalls.map((call) => <Card className="trace-item" key={call.id}><CardContent className="trace-content"><strong>{call.name}</strong><span>{call.status === 'succeeded' ? '成功' : '失败'}</span><code>{call.maskedArguments}</code></CardContent></Card>)}</section>;
}
