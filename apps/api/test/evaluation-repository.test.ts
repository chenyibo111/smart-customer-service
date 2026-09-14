import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { seedEvaluationCases } from '../src/db/seed.js';
import { EvaluationRepository } from '../src/repositories/evaluation-repository.js';

describe('EvaluationRepository', () => {
  let database: AppDatabase;

  beforeEach(() => {
    database = createDatabase(':memory:');
    migrate(database);
  });

  afterEach(() => database.close());

  it('stores six immutable cases and returns a completed run with safe observations', () => {
    seedEvaluationCases(database);
    seedEvaluationCases(database);
    const repository = new EvaluationRepository(database);

    expect(repository.listCases()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'refund-answer', question: '怎么退款？', expectedSourceLabel: '退款说明' }),
      expect.objectContaining({ id: 'customer-requested-human', expectedHandoffReason: 'customer_requested' }),
    ]));
    expect(repository.listCases()).toHaveLength(6);

    const run = repository.createRun('offline');
    repository.recordResult({
      runId: run.id,
      caseId: 'refund-answer',
      outcome: 'answer',
      citationLabels: ['退款说明'],
      toolNames: [],
      handoffReason: null,
      answerContent: '您可在七日内申请退款。',
      elapsedMs: 4,
      passed: true,
      failureReason: null,
    });
    repository.completeRun({ id: run.id, totalCount: 1, passCount: 1, elapsedMs: 4 });

    expect(repository.listRuns()).toEqual([
      expect.objectContaining({ id: run.id, mode: 'offline', status: 'completed', totalCount: 1, passCount: 1, elapsedMs: 4 }),
    ]);
    expect(repository.getRun(run.id)).toMatchObject({
      run: { id: run.id, status: 'completed', passCount: 1 },
      results: [expect.objectContaining({
        caseId: 'refund-answer',
        question: '怎么退款？',
        citationLabels: ['退款说明'],
        answerContent: '您可在七日内申请退款。',
        passed: true,
      })],
    });
  });
});
