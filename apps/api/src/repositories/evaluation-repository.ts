import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';
import type { EvaluationCase, EvaluationMode, EvaluationObservation, EvaluationResult, EvaluationRun, EvaluationRunDetail, HandoffReason } from '../evaluations/contracts.js';

type CaseRow = {
  id: string;
  fixture_version: string;
  name: string;
  question: string;
  expected_outcome: EvaluationCase['expectedOutcome'];
  expected_source_label: string | null;
  expected_tool_name: 'query_order' | null;
  expected_handoff_reason: HandoffReason | null;
};

type RunRow = {
  id: string;
  mode: EvaluationMode;
  status: EvaluationRun['status'];
  started_at: string;
  completed_at: string | null;
  total_count: number;
  pass_count: number;
  elapsed_ms: number | null;
};

type ResultRow = {
  id: string;
  run_id: string;
  case_id: string;
  observed_outcome: EvaluationObservation['outcome'];
  citation_labels_json: string;
  tool_names_json: string;
  handoff_reason: HandoffReason | null;
  answer_content: string | null;
  elapsed_ms: number;
  passed: number;
  failure_reason: string | null;
  created_at: string;
  name: string;
  question: string;
  expected_outcome: EvaluationCase['expectedOutcome'];
  expected_source_label: string | null;
  expected_tool_name: string | null;
  expected_handoff_reason: HandoffReason | null;
};

const toCase = (row: CaseRow): EvaluationCase => ({
  id: row.id,
  fixtureVersion: row.fixture_version,
  name: row.name,
  question: row.question,
  expectedOutcome: row.expected_outcome,
  expectedSourceLabel: row.expected_source_label,
  expectedToolName: row.expected_tool_name,
  expectedHandoffReason: row.expected_handoff_reason,
});

const toRun = (row: RunRow): EvaluationRun => ({
  id: row.id,
  mode: row.mode,
  status: row.status,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  totalCount: row.total_count,
  passCount: row.pass_count,
  elapsedMs: row.elapsed_ms,
});

const toResult = (row: ResultRow): EvaluationResult => ({
  id: row.id,
  runId: row.run_id,
  caseId: row.case_id,
  name: row.name,
  question: row.question,
  expectedOutcome: row.expected_outcome,
  expectedSourceLabel: row.expected_source_label,
  expectedToolName: row.expected_tool_name,
  expectedHandoffReason: row.expected_handoff_reason,
  outcome: row.observed_outcome,
  citationLabels: JSON.parse(row.citation_labels_json) as string[],
  toolNames: JSON.parse(row.tool_names_json) as string[],
  handoffReason: row.handoff_reason,
  answerContent: row.answer_content,
  elapsedMs: row.elapsed_ms,
  passed: row.passed === 1,
  failureReason: row.failure_reason,
  createdAt: row.created_at,
});

export class EvaluationRepository {
  constructor(private readonly database: AppDatabase) {}

  listCases(): EvaluationCase[] {
    return (this.database.prepare('SELECT * FROM evaluation_cases ORDER BY rowid').all() as CaseRow[]).map(toCase);
  }

  createRun(mode: EvaluationMode): EvaluationRun {
    const run: EvaluationRun = {
      id: randomUUID(),
      mode,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      totalCount: 0,
      passCount: 0,
      elapsedMs: null,
    };
    this.database.prepare(
      'INSERT INTO evaluation_runs (id, mode, status, started_at, completed_at, total_count, pass_count, elapsed_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(run.id, run.mode, run.status, run.startedAt, run.completedAt, run.totalCount, run.passCount, run.elapsedMs);
    return run;
  }

  completeRun(input: { id: string; totalCount: number; passCount: number; elapsedMs: number }): void {
    this.database.prepare(
      'UPDATE evaluation_runs SET status = ?, completed_at = ?, total_count = ?, pass_count = ?, elapsed_ms = ? WHERE id = ?',
    ).run('completed', new Date().toISOString(), input.totalCount, input.passCount, input.elapsedMs, input.id);
  }

  recordResult(input: EvaluationObservation & { runId: string; caseId: string; elapsedMs: number; passed: boolean }): void {
    this.database.prepare(
      `INSERT INTO evaluation_results
        (id, run_id, case_id, observed_outcome, citation_labels_json, tool_names_json, handoff_reason, answer_content, elapsed_ms, passed, failure_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(), input.runId, input.caseId, input.outcome, JSON.stringify(input.citationLabels), JSON.stringify(input.toolNames), input.handoffReason,
      input.answerContent, input.elapsedMs, input.passed ? 1 : 0, input.failureReason, new Date().toISOString(),
    );
  }

  listRuns(limit = 20): EvaluationRun[] {
    return (this.database.prepare('SELECT * FROM evaluation_runs ORDER BY started_at DESC LIMIT ?').all(limit) as RunRow[]).map(toRun);
  }

  getRun(id: string): EvaluationRunDetail | undefined {
    const run = this.database.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get(id) as RunRow | undefined;
    if (!run) return undefined;
    const results = this.database.prepare(
      `SELECT r.*, c.name, c.question, c.expected_outcome, c.expected_source_label, c.expected_tool_name, c.expected_handoff_reason
       FROM evaluation_results r JOIN evaluation_cases c ON c.id = r.case_id
       WHERE r.run_id = ? ORDER BY r.created_at`,
    ).all(id) as ResultRow[];
    return { run: toRun(run), results: results.map(toResult) };
  }
}
