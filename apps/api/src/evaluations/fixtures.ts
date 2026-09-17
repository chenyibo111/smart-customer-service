import type { AppDatabase } from '../db/database.js';
import type { EvaluationCase } from './contracts.js';

export const EVALUATION_FIXTURE_VERSION = 'v1';

export const evaluationFixtures: EvaluationCase[] = [
  { id: 'refund-answer', fixtureVersion: EVALUATION_FIXTURE_VERSION, name: '退款知识问答', question: '怎么退款？', expectedOutcome: 'answer', expectedSourceLabel: '退款说明', expectedToolName: null, expectedHandoffReason: null },
  { id: 'valid-order-a1001', fixtureVersion: EVALUATION_FIXTURE_VERSION, name: '有效订单查询', question: '订单 A1001 到哪了？', expectedOutcome: 'answer', expectedSourceLabel: '订单说明', expectedToolName: 'query_order', expectedHandoffReason: null },
  { id: 'malformed-order', fixtureVersion: EVALUATION_FIXTURE_VERSION, name: '异常订单格式', question: '订单 A12 到哪了？', expectedOutcome: 'handoff', expectedSourceLabel: null, expectedToolName: null, expectedHandoffReason: 'service_failure' },
  { id: 'unknown-question', fixtureVersion: EVALUATION_FIXTURE_VERSION, name: '未知业务问题', question: '你们线下门店在哪里？', expectedOutcome: 'handoff', expectedSourceLabel: null, expectedToolName: null, expectedHandoffReason: 'insufficient_knowledge' },
  { id: 'customer-requested-human', fixtureVersion: EVALUATION_FIXTURE_VERSION, name: '用户请求人工', question: '请转人工客服。', expectedOutcome: 'handoff', expectedSourceLabel: null, expectedToolName: null, expectedHandoffReason: 'customer_requested' },
  { id: 'missing-evidence', fixtureVersion: EVALUATION_FIXTURE_VERSION, name: '缺少知识依据', question: '如何修改尚未发货的订单地址？', expectedOutcome: 'handoff', expectedSourceLabel: null, expectedToolName: null, expectedHandoffReason: 'insufficient_knowledge' },
];

export function seedEvaluationCases(database: AppDatabase): void {
  const insert = database.prepare(
    `INSERT OR IGNORE INTO evaluation_cases
      (id, fixture_version, name, question, expected_outcome, expected_source_label, expected_tool_name, expected_handoff_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const createdAt = new Date().toISOString();
  const transaction = database.transaction(() => {
    for (const item of evaluationFixtures) {
      insert.run(item.id, item.fixtureVersion, item.name, item.question, item.expectedOutcome, item.expectedSourceLabel, item.expectedToolName, item.expectedHandoffReason, createdAt);
    }
  });
  transaction();
}
