import type { EvaluationCase, EvaluationObservation, EvaluationScore } from './contracts.js';

function fail(failureReason: string): EvaluationScore {
  return { passed: false, failureReason };
}

export function scoreEvaluationCase(caseRecord: EvaluationCase, observed: EvaluationObservation): EvaluationScore {
  if (observed.outcome !== caseRecord.expectedOutcome) {
    return fail(`预期结果为${caseRecord.expectedOutcome}，实际为${observed.outcome}。`);
  }
  if (caseRecord.expectedSourceLabel && !observed.citationLabels.includes(caseRecord.expectedSourceLabel)) {
    return fail(`未引用预期知识来源：${caseRecord.expectedSourceLabel}。`);
  }
  if (caseRecord.expectedToolName && !observed.toolNames.includes(caseRecord.expectedToolName)) {
    return fail(`未调用预期工具：${caseRecord.expectedToolName}。`);
  }
  if (caseRecord.expectedHandoffReason && observed.handoffReason !== caseRecord.expectedHandoffReason) {
    return fail('转人工原因不符合预期。');
  }
  return { passed: true, failureReason: null };
}
