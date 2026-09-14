import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { seedEvaluationCases } from '../src/db/seed.js';
import { EvaluationRunner } from '../src/evaluations/runner.js';
import { EvaluationRepository } from '../src/repositories/evaluation-repository.js';

describe('EvaluationRunner', () => {
  let database: AppDatabase;

  beforeEach(() => {
    database = createDatabase(':memory:');
    migrate(database);
    seedEvaluationCases(database);
  });

  afterEach(() => database.close());

  it('runs all six cases offline through isolated orchestrators and persists observations', async () => {
    const runner = new EvaluationRunner({ repository: new EvaluationRepository(database) });

    const detail = await runner.run('offline');

    expect(detail.run).toMatchObject({ mode: 'offline', status: 'completed', totalCount: 6, passCount: 6 });
    expect(detail.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ caseId: 'refund-answer', citationLabels: ['退款说明'], passed: true }),
      expect.objectContaining({ caseId: 'valid-order-a1001', toolNames: ['query_order'], passed: true }),
      expect.objectContaining({ caseId: 'customer-requested-human', handoffReason: 'customer_requested', passed: true }),
    ]));
    expect(database.prepare('SELECT COUNT(*) AS count FROM conversations').get()).toEqual({ count: 0 });
  });

  it('records a safe failed result and continues the batch when one case dependency throws', async () => {
    const runner = new EvaluationRunner({
      repository: new EvaluationRepository(database),
      createOfflineDependencies: async ({ caseRecord }) => {
        if (caseRecord.id === 'missing-evidence') throw new Error('provider exploded: sensitive detail');
        return EvaluationRunner.createOfflineDependencies({ caseRecord });
      },
    });

    const detail = await runner.run('offline');

    expect(detail.run).toMatchObject({ totalCount: 6, passCount: 5 });
    expect(detail.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ caseId: 'missing-evidence', outcome: 'failed', passed: false, failureReason: '评估执行失败。' }),
      expect.objectContaining({ caseId: 'refund-answer', passed: true }),
    ]));
  });
});
