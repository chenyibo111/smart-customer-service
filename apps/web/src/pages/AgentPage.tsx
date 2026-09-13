import { useEffect, useState } from 'react';

import { staffApi, type StaffApi, type Ticket } from '../app/api.js';
import { TicketQueue } from '../components/TicketQueue.js';

export function AgentPage({ client = staffApi }: { client?: StaffApi }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = async () => { try { setTickets(await client.listTickets()); } catch (error) { setNotice(error instanceof Error ? error.message : '无法加载工单。'); } };
  useEffect(() => { void refresh(); }, [client]);
  const claim = async (ticketId: string) => { try { const result = await client.claimTicket(ticketId); setActiveTicket(result.ticket); setTickets((current) => current.filter((ticket) => ticket.id !== ticketId)); setNotice('人工处理中'); } catch (error) { setNotice(error instanceof Error ? error.message : '工单无法接管。'); } };

  return <main className="workspace"><header className="workspace-header"><span className="eyebrow">坐席工作台</span><h1>人工客服队列</h1><p>演示身份：客服小陈</p></header>{notice && <p className="notice" role="status">{notice}</p>}{activeTicket ? <ActiveTicket ticket={activeTicket} client={client} onClosed={() => { setActiveTicket(null); setNotice('工单已解决'); }} /> : <TicketQueue tickets={tickets} onClaim={claim} />}</main>;
}

function ActiveTicket({ ticket, client, onClosed }: { ticket: Ticket; client: StaffApi; onClosed(): void }) {
  const [content, setContent] = useState('');
  const [notice, setNotice] = useState('');
  return <section className="active-ticket"><h2>人工处理中</h2><p>工单：{ticket.id}</p><form onSubmit={(event) => { event.preventDefault(); if (!content.trim()) return; void client.sendMessage(ticket.id, content).then(() => { setContent(''); setNotice('已发送'); }).catch(() => setNotice('发送失败。')); }}><textarea aria-label="人工回复" value={content} onChange={(event) => setContent(event.target.value)} /><button type="submit">发送回复</button></form><button className="secondary" onClick={() => void client.closeTicket(ticket.id).then(onClosed)}>关闭工单</button>{notice && <p className="notice">{notice}</p>}</section>;
}
