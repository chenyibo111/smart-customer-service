import { Badge, Button, Card, CardContent, Empty } from '@chenyibo111/ui';
import type { Ticket } from '../app/api.js';

export function TicketQueue({ tickets, onClaim }: { tickets: Ticket[]; onClaim(ticketId: string): Promise<void> }) {
  if (tickets.length === 0) return <Empty title="当前没有待接管工单。" />;
  return <section className="ticket-queue">{tickets.map((ticket) => <Card className="ticket" key={ticket.id}><CardContent><div><Badge variant="warning">待接管</Badge><strong>待处理工单</strong><p>原因：{ticket.reason ?? '客户请求人工协助'}</p></div><Button onClick={() => void onClaim(ticket.id)}>接管</Button></CardContent></Card>)}</section>;
}
