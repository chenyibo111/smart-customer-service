import { z } from 'zod';

import type { AppDatabase } from '../db/database.js';

const orderInput = z.object({ orderId: z.string().regex(/^A\d{4}$/, 'invalid order ID') });

export type OrderResult = { orderId: string; status: string; summary: string };

export class OrderTool {
  constructor(private readonly database: AppDatabase) {}

  queryOrder(input: unknown): OrderResult {
    const parsed = orderInput.safeParse(input);
    if (!parsed.success) throw new Error('invalid order ID');

    const order = this.database
      .prepare('SELECT id, status, summary FROM demo_orders WHERE id = ?')
      .get(parsed.data.orderId) as { id: string; status: string; summary: string } | undefined;
    if (!order) throw new Error('order not found');

    return { orderId: order.id, status: order.status, summary: order.summary };
  }
}
