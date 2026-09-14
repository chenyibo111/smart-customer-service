import { describe, expect, it } from 'vitest';

import type { EvaluationCase, EvaluationObservation } from '../src/evaluations/contracts.js';
import { scoreEvaluationCase } from '../src/evaluations/scoring.js';

const refundCase: EvaluationCase = {
  id: 'refund-answer',
  fixtureVersion: 'v1',
  name: '退款知识问答',
  question: '怎么退款？',
  expectedOutcome: 'answer',
  expectedSourceLabel: '退款说明',
  expectedToolName: null,
  expectedHandoffReason: null,
};

function observation(overrides: Partial<EvaluationObservation> = {}): EvaluationObservation {
  return {
    outcome: 'answer',
    citationLabels: ['退款说明'],
    toolNames: [],
    handoffReason: null,
    answerContent: '您可在七日内申请退款。',
    failureReason: null,
    ...overrides,
  };
}

describe('scoreEvaluationCase', () => {
  it('passes when all declared observable behaviors match', () => {
    expect(scoreEvaluationCase(refundCase, observation())).toEqual({ passed: true, failureReason: null });
  });

  it('fails when the observed outcome differs', () => {
    expect(scoreEvaluationCase(refundCase, observation({ outcome: 'handoff', handoffReason: 'insufficient_knowledge' })))
      .toEqual({ passed: false, failureReason: '预期结果为answer，实际为handoff。' });
  });

  it('fails when the required citation label is absent', () => {
    expect(scoreEvaluationCase(refundCase, observation({ citationLabels: [] })))
      .toEqual({ passed: false, failureReason: '未引用预期知识来源：退款说明。' });
  });

  it('fails when the required tool is absent', () => {
    const orderCase: EvaluationCase = { ...refundCase, expectedToolName: 'query_order' };
    expect(scoreEvaluationCase(orderCase, observation()))
      .toEqual({ passed: false, failureReason: '未调用预期工具：query_order。' });
  });

  it('fails when the required handoff reason differs', () => {
    const handoffCase: EvaluationCase = {
      ...refundCase,
      expectedOutcome: 'handoff',
      expectedSourceLabel: null,
      expectedHandoffReason: 'customer_requested',
    };
    expect(scoreEvaluationCase(handoffCase, observation({ outcome: 'handoff', handoffReason: 'insufficient_knowledge' })))
      .toEqual({ passed: false, failureReason: '转人工原因不符合预期。' });
  });
});
