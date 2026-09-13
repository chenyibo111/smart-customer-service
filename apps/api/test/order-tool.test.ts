import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { seedDemoOrders } from '../src/db/seed.js';
import { OrderTool } from '../src/agent/order-tool.js';

describe('OrderTool', () => {
  let database: AppDatabase;
  let tool: OrderTool;

  beforeEach(() => {
    database = createDatabase(':memory:');
    migrate(database);
    seedDemoOrders(database);
    tool = new OrderTool(database);
  });

  afterEach(() => database.close());

  it('returns only a seeded demo order for a valid identifier', () => {
    expect(tool.queryOrder({ orderId: 'A1001' })).toEqual({
      orderId: 'A1001',
      status: '已发货',
      summary: '包裹已由仓库发出，等待物流揽收。',
    });
  });

  it('rejects malformed and unknown identifiers', () => {
    expect(() => tool.queryOrder({ orderId: 'DROP TABLE' })).toThrow('invalid order ID');
    expect(() => tool.queryOrder({ orderId: 'A9999' })).toThrow('order not found');
  });
});
