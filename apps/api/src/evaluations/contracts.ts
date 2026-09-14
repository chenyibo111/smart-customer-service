export type EvaluationMode = 'offline' | 'real';
export type EvaluationOutcome = 'answer' | 'handoff' | 'failed';
export type HandoffReason = 'insufficient_knowledge' | 'customer_requested' | 'service_failure';

export type EvaluationCase = {
  id: string;
  fixtureVersion: string;
  name: string;
  question: string;
  expectedOutcome: Extract<EvaluationOutcome, 'answer' | 'handoff'>;
  expectedSourceLabel: string | null;
  expectedToolName: 'query_order' | null;
  expectedHandoffReason: HandoffReason | null;
};

export type EvaluationObservation = {
  outcome: EvaluationOutcome;
  citationLabels: string[];
  toolNames: string[];
  handoffReason: HandoffReason | null;
  answerContent: string | null;
  failureReason: string | null;
};

export type EvaluationExpectation = Pick<
  EvaluationCase,
  'expectedOutcome' | 'expectedSourceLabel' | 'expectedToolName' | 'expectedHandoffReason'
>;

export type EvaluationScore = { passed: boolean; failureReason: string | null };
