import { useEffect, useState } from 'react';

import { staffApi, type StaffApi, type Ticket, type TicketContext } from '../app/api.js';
import { TicketQueue } from '../components/TicketQueue.js';
import { MessageList } from '../components/MessageList.js';

export function AgentPage({ client = staffApi }: { client?: StaffApi }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [context, setContext] = useState<TicketContext | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = async () => { try { setTickets(await client.listTickets()); } catch (error) { setNotice(error instanceof Error ? error.message : '无法加载工单。'); } };
  useEffect(() => { void refresh(); }, [client]);
  const claim = async (ticketId: string) => { try { const result = await client.claimTicket(ticketId); const ticketContext = await client.getTicketContext(ticketId); setActiveTicket(result.ticket); setContext(ticketContext); setTickets((current) => current.filter((ticket) => ticket.id !== ticketId)); setNotice('人工处理中'); } catch (error) { setNotice(error instanceof Error ? error.message : '工单无法接管。'); } };

  return <main className="workspace"><header className="workspace-header"><span className="eyebrow">坐席工作台</span><h1>人工客服队列</h1><p>演示身份：客服小陈</p></header>{notice && <p className="notice" role="status">{notice}</p>}{activeTicket ? <ActiveTicket ticket={activeTicket} context={context} client={client} onClosed={() => { setActiveTicket(null); setContext(null); setNotice('工单已解决'); }} /> : <TicketQueue tickets={tickets} onClaim={claim} />}</main>;
}

function ActiveTicket({ ticket, context, client, onClosed }: { ticket: Ticket; context: TicketContext | null; client: StaffApi; onClosed(): void }) {
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState(context?.messages ?? []);
  const [notice, setNotice] = useState('');
  return <section className="active-ticket"><h2>人工处理中</h2><p>工单：{ticket.id}</p><h3>客户上下文</h3>{context ? <MessageList messages={messages} /> : <p className="empty-state">正在加载会话上下文…</p>}<form onSubmit={(event) => { event.preventDefault(); if (!content.trim()) return; void client.sendMessage(ticket.id, content).then((message) => { setMessages((current) => [...current, message]); setContent(''); setNotice('已发送'); }).catch(() => setNotice('发送失败。')); }}><textarea aria-label="人工回复" value={content} onChange={(event) => setContent(event.target.value)} /><button type="submit">发送回复</button></form><button className="secondary" onClick={() => void client.closeTicket(ticket.id).then(onClosed)}>关闭工单</button>{notice && <p className="notice">{notice}</p>}</section>;
}
