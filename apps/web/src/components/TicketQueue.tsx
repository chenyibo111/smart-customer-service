import type { Ticket } from '../app/api.js';

export function TicketQueue({ tickets, onClaim }: { tickets: Ticket[]; onClaim(ticketId: string): Promise<void> }) {
  if (tickets.length === 0) return <p className="empty-state">当前没有待接管工单。</p>;
  return <section className="ticket-queue">{tickets.map((ticket) => <article className="ticket" key={ticket.id}><div><strong>待处理工单</strong><p>原因：{ticket.reason ?? '客户请求人工协助'}</p></div><button onClick={() => void onClaim(ticket.id)}>接管</button></article>)}</section>;
}
