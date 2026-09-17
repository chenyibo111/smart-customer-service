import type { AppDatabase } from './database.js';

export { seedEvaluationCases } from '../evaluations/fixtures.js';

export function seedDemoOrders(database: AppDatabase): void {
  const insert = database.prepare(
    'INSERT OR REPLACE INTO demo_orders (id, status, summary) VALUES (?, ?, ?)',
  );

  insert.run('A1001', '已发货', '包裹已由仓库发出，等待物流揽收。');
  insert.run('A2002', '处理中', '订单正在为您配货。');
}
