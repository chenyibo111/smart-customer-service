# Agent Evaluation Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an administrator-facing evaluation center that runs deterministic or real-model customer-service Agent cases and stores safe, reviewable results.

**Architecture:** Add evaluation contracts, SQLite persistence, and a runner that executes each case in a fresh in-memory database through `AgentOrchestrator`. Offline adapters make the test suite deterministic; real mode injects the existing local embedding retriever and server-side `DeepSeekClient`. Admin routes expose summaries and details, while the existing `/admin` page starts and displays runs.

**Tech Stack:** TypeScript, Fastify, better-sqlite3, Zod, Vitest, React 19, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-14-agent-evaluation-center-design.md`

## Global Constraints

- Evaluation runs must not read or write customer conversations, tickets, or knowledge records.
- Offline mode is the default and must not call DeepSeek or download embedding models.
- Real mode alone may instantiate `LocalEmbeddingProvider` and `DeepSeekClient`; API keys stay server-only.
- Persist no API key, raw provider response, hidden reasoning, or unmasked order identifier.
- Scoring compares declared observable behavior only; it must never compare answer prose.
- Use existing Chinese safe-error conventions: `{ code, message }` for invalid requests and concise user-safe failures for runtime problems.

---

### Task 1: Define evaluation contracts, scoring, and explicit human-request handling

**Files:**
- Create: `apps/api/src/evaluations/contracts.ts`
- Create: `apps/api/src/evaluations/scoring.ts`
- Create: `apps/api/test/evaluation-scoring.test.ts`
- Modify: `apps/api/src/agent/orchestrator.ts`
- Modify: `apps/api/test/orchestrator.test.ts`

**Interfaces:**
- Produces `EvaluationCase`, `EvaluationObservation`, `EvaluationExpectation`, and `scoreEvaluationCase(caseRecord, observation): EvaluationScore`.
- Produces `isExplicitHumanRequest(message): boolean`, used by `AgentOrchestrator.respond` before retrieval.
- `EvaluationObservation` has `outcome: 'answer' | 'handoff' | 'failed'`, `citationLabels: string[]`, `toolNames: string[]`, `handoffReason?: HandoffReason`, `answerContent?: string`, and `failureReason?: string`.

- [ ] **Step 1: Write the failing scoring and explicit-handoff tests**

```ts
it('fails an answer result when the required citation label is absent', () => {
  const result = scoreEvaluationCase(refundCase, {
    outcome: 'answer', citationLabels: [], toolNames: [], answerContent: '可退款。',
  });
  expect(result).toEqual({ passed: false, failureReason: '未引用预期知识来源：退款说明。' });
});

it('hands an explicit request for a person to a human before retrieval', async () => {
  const events = await collect(orchestrator.respond({ conversationId, message: '请转人工客服。' }));
  expect(events).toEqual([expect.objectContaining({ type: 'handoff', reason: 'customer_requested' })]);
});
```

The production changes these tests must catch are a scorer that ignores required evidence and an orchestrator that sends an explicit human request to retrieval/model processing.

- [ ] **Step 2: Run the focused tests and verify they fail for missing exports/behavior**

Run: `npm run test --workspace @smart-cs/api -- test/evaluation-scoring.test.ts test/orchestrator.test.ts`

Expected: FAIL because `scoreEvaluationCase` and the explicit pre-retrieval handoff behavior do not exist.

- [ ] **Step 3: Implement the minimal contracts, scorer, and early handoff branch**

```ts
export function scoreEvaluationCase(caseRecord: EvaluationCase, observed: EvaluationObservation): EvaluationScore {
  if (observed.outcome !== caseRecord.expectedOutcome) return fail(`预期结果为${caseRecord.expectedOutcome}，实际为${observed.outcome}。`);
  if (caseRecord.expectedSourceLabel && !observed.citationLabels.includes(caseRecord.expectedSourceLabel)) return fail(`未引用预期知识来源：${caseRecord.expectedSourceLabel}。`);
  if (caseRecord.expectedToolName && !observed.toolNames.includes(caseRecord.expectedToolName)) return fail(`未调用预期工具：${caseRecord.expectedToolName}。`);
  if (caseRecord.expectedHandoffReason !== observed.handoffReason) return fail(`转人工原因不符合预期。`);
  return { passed: true, failureReason: null };
}
```

At the start of `respond`, append the customer message and call `requestHumanHandoff(conversation.id, 'customer_requested')` when `isExplicitHumanRequest(input.message)` recognizes phrases such as `转人工`, `人工客服`, or `找客服`; yield the existing safe handoff event and return. Keep nonmatching requests on the existing retrieval path.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm run test --workspace @smart-cs/api -- test/evaluation-scoring.test.ts test/orchestrator.test.ts`

Expected: PASS, including the new scorer branches and customer-requested handoff.

- [ ] **Step 5: Commit the tested behavior**

```bash
git add apps/api/src/evaluations/contracts.ts apps/api/src/evaluations/scoring.ts apps/api/src/agent/orchestrator.ts apps/api/test/evaluation-scoring.test.ts apps/api/test/orchestrator.test.ts
git commit -m "feat: add evaluation scoring contracts"
```

### Task 2: Persist seeded cases and safe run/result history

**Files:**
- Modify: `apps/api/src/db/schema.sql`
- Create: `apps/api/src/evaluations/fixtures.ts`
- Create: `apps/api/src/repositories/evaluation-repository.ts`
- Modify: `apps/api/src/db/seed.ts`
- Create: `apps/api/test/evaluation-repository.test.ts`

**Interfaces:**
- Produces `seedEvaluationCases(database): void` with six `evaluation_cases` contracts.
- Produces `EvaluationRepository` methods `listCases()`, `createRun(mode)`, `completeRun(input)`, `recordResult(input)`, `listRuns(limit)`, and `getRun(id)`.
- `getRun(id)` returns `{ run: EvaluationRun; results: EvaluationResult[] } | undefined` with question and expected values joined from the case record.

- [ ] **Step 1: Write the failing persistence test**

```ts
it('stores six immutable cases and returns a completed run with safe observations', () => {
  seedEvaluationCases(database);
  const repository = new EvaluationRepository(database);
  expect(repository.listCases()).toHaveLength(6);
  const run = repository.createRun('offline');
  repository.recordResult({ runId: run.id, caseId: 'refund-answer', outcome: 'answer', citationLabels: ['退款说明'], toolNames: [], handoffReason: null, answerContent: '七日内可申请退款。', elapsedMs: 4, passed: true, failureReason: null });
  repository.completeRun({ id: run.id, totalCount: 1, passCount: 1, elapsedMs: 4 });
  expect(repository.getRun(run.id)).toMatchObject({ run: { status: 'completed', passCount: 1 }, results: [expect.objectContaining({ question: '怎么退款？', passed: true })] });
});
```

The production changes this test must catch are missing fixture seeding, incorrect pass-count persistence, or result detail that cannot be rendered without exposing raw provider data.

- [ ] **Step 2: Run the repository test and verify it fails**

Run: `npm run test --workspace @smart-cs/api -- test/evaluation-repository.test.ts`

Expected: FAIL because the evaluation schema, seed function, and repository are absent.

- [ ] **Step 3: Add schema, deterministic fixture seed, and repository mapping**

```sql
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  total_count INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  elapsed_ms INTEGER
);
```

Add `evaluation_cases` and `evaluation_results` with foreign keys to the case/run records. Seed fixed IDs for: `refund-answer`, `valid-order-a1001`, `malformed-order`, `unknown-question`, `customer-requested-human`, and `missing-evidence`. Use `INSERT OR IGNORE`, a fixture version column, and only safe customer questions/expected behavior. Store citation/tool labels as JSON arrays; return parsed arrays from the repository.

- [ ] **Step 4: Run the repository test and verify it passes**

Run: `npm run test --workspace @smart-cs/api -- test/evaluation-repository.test.ts`

Expected: PASS with six cases and a queryable completed run.

- [ ] **Step 5: Commit the persistence layer**

```bash
git add apps/api/src/db/schema.sql apps/api/src/db/seed.ts apps/api/src/evaluations/fixtures.ts apps/api/src/repositories/evaluation-repository.ts apps/api/test/evaluation-repository.test.ts
git commit -m "feat: persist agent evaluation runs"
```

### Task 3: Execute isolated offline and real-model evaluation batches

**Files:**
- Create: `apps/api/src/evaluations/runner.ts`
- Create: `apps/api/test/evaluation-runner.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Produces `EvaluationRunner.run(mode: 'offline' | 'real'): Promise<EvaluationRunDetail>`.
- Constructor accepts the primary `EvaluationRepository` plus a `createRealDependencies` factory; it opens and closes a fresh `:memory:` database for every case.
- Produces deterministic `OfflineRetriever` and `OfflineChatModel` fixtures inside `runner.ts`; they implement existing `RetrievalService` and `ChatModel` contracts.

- [ ] **Step 1: Write the failing runner tests**

```ts
it('runs all six cases offline through isolated orchestrators and persists their observations', async () => {
  const detail = await runner.run('offline');
  expect(detail.run).toMatchObject({ mode: 'offline', status: 'completed', totalCount: 6, passCount: 6 });
  expect(detail.results).toEqual(expect.arrayContaining([
    expect.objectContaining({ caseId: 'valid-order-a1001', toolNames: ['query_order'], passed: true }),
    expect.objectContaining({ caseId: 'customer-requested-human', handoffReason: 'customer_requested', passed: true }),
  ]));
});

it('records a safe failed result and continues the batch when one case throws', async () => {
  const detail = await failingRunner.run('offline');
  expect(detail.results).toEqual(expect.arrayContaining([expect.objectContaining({ passed: false, failureReason: '评估执行失败。' })]));
  expect(detail.run.totalCount).toBe(6);
});
```

The production changes these tests must catch are a runner that shares customer data, skips a case after failure, compares prose, or fails to collect tool/citation/handoff events.

- [ ] **Step 2: Run the runner tests and verify they fail**

Run: `npm run test --workspace @smart-cs/api -- test/evaluation-runner.test.ts`

Expected: FAIL because `EvaluationRunner` is absent.

- [ ] **Step 3: Implement case execution and wire real-mode construction in the server**

```ts
for (const caseRecord of this.repository.listCases()) {
  const isolatedDatabase = createDatabase(':memory:');
  try {
    migrate(isolatedDatabase);
    seedDemoOrders(isolatedDatabase);
    const events = await collect(orchestrator.respond({ conversationId, message: caseRecord.question }));
    const observation = observeEvents(events, elapsedMs);
    this.repository.recordResult({ ...observation, ...scoreEvaluationCase(caseRecord, observation) });
  } catch {
    this.repository.recordResult({ outcome: 'failed', citationLabels: [], toolNames: [], handoffReason: null, answerContent: null, elapsedMs, passed: false, failureReason: '评估执行失败。' });
  } finally {
    isolatedDatabase.close();
  }
}
```

Offline fixtures must return known retrieval source labels and model actions for the six case IDs. Real mode must seed equivalent temporary knowledge, build a `Retriever` with `LocalEmbeddingProvider`, build `DeepSeekClient` from loaded server config, and throw a safe configuration failure if `DEEPSEEK_API_KEY` is absent. The runner stores only token text as `answerContent`; it never stores raw responses or input arguments. In `server.ts`, call `seedEvaluationCases(database)`, construct the runner, and pass it to `buildApp`.

- [ ] **Step 4: Run runner tests and the existing orchestrator tests**

Run: `npm run test --workspace @smart-cs/api -- test/evaluation-runner.test.ts test/orchestrator.test.ts`

Expected: PASS without a DeepSeek key, network request, or embedding-model download.

- [ ] **Step 5: Commit the isolated execution layer**

```bash
git add apps/api/src/evaluations/runner.ts apps/api/src/server.ts apps/api/test/evaluation-runner.test.ts
git commit -m "feat: run isolated agent evaluations"
```

### Task 4: Expose evaluation administration APIs

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/test/routes.test.ts`

**Interfaces:**
- Extends `buildApp(input)` with optional `evaluations?: EvaluationRunner`.
- Adds `GET /api/admin/evaluations/cases`, `POST /api/admin/evaluations/runs`, `GET /api/admin/evaluations/runs`, and `GET /api/admin/evaluations/runs/:id`.
- `POST` accepts only `{ mode: 'offline' | 'real' }`; unavailable runner replies `503` with `{ code: 'SERVICE_UNAVAILABLE', message: '评估中心暂时不可用。' }`.

- [ ] **Step 1: Write failing API integration tests**

```ts
it('runs the offline evaluation batch and returns persisted detail', async () => {
  const started = await app.inject({ method: 'POST', url: '/api/admin/evaluations/runs', payload: { mode: 'offline' } });
  expect(started.statusCode).toBe(201);
  expect(started.json()).toMatchObject({ run: { mode: 'offline', totalCount: 6, passCount: 6 } });
  const detail = await app.inject({ method: 'GET', url: `/api/admin/evaluations/runs/${started.json().run.id}` });
  expect(detail.json().results).toHaveLength(6);
});

it('rejects an unsupported evaluation mode', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/admin/evaluations/runs', payload: { mode: 'preview' } });
  expect(response).toMatchObject({ statusCode: 400 });
  expect(response.json()).toEqual({ code: 'INVALID_REQUEST', message: '评估模式无效。' });
});
```

The production changes these tests must catch are accepting invalid modes, skipping offline execution, or losing persisted case detail after the run response.

- [ ] **Step 2: Run route tests and verify they fail**

Run: `npm run test --workspace @smart-cs/api -- test/routes.test.ts`

Expected: FAIL because no evaluation routes are registered.

- [ ] **Step 3: Register validated routes and repository-backed reads**

```ts
const evaluationRunInput = z.object({ mode: z.enum(['offline', 'real']) });
app.post('/api/admin/evaluations/runs', async (request, reply) => {
  const parsed = evaluationRunInput.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', message: '评估模式无效。' });
  if (!dependencies.evaluations) return reply.code(503).send({ code: 'SERVICE_UNAVAILABLE', message: '评估中心暂时不可用。' });
  return reply.code(201).send(await dependencies.evaluations.run(parsed.data.mode));
});
```

Return `404` with `{ code: 'NOT_FOUND', message: '评估运行不存在。' }` for an unknown detail ID. Keep `GET` endpoints read-only and avoid serializing database/provider errors.

- [ ] **Step 4: Run route tests and verify they pass**

Run: `npm run test --workspace @smart-cs/api -- test/routes.test.ts`

Expected: PASS, including existing routes and all evaluation route contracts.

- [ ] **Step 5: Commit the API surface**

```bash
git add apps/api/src/app.ts apps/api/src/routes/admin.ts apps/api/test/routes.test.ts
git commit -m "feat: expose evaluation administration APIs"
```

### Task 5: Build the administrator Evaluation Center

**Files:**
- Modify: `apps/web/src/app/api.ts`
- Create: `apps/web/src/components/EvaluationCenter.tsx`
- Modify: `apps/web/src/pages/AdminPage.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/test/AdminPage.test.tsx`

**Interfaces:**
- Extends `AdminApi` with `listEvaluationCases()`, `runEvaluation(mode)`, `listEvaluationRuns()`, and `getEvaluationRun(id)`.
- `EvaluationCenter` takes `{ client: AdminApi }`, loads history/cases on mount, starts offline by default, and shows a selected run's safe result details.

- [ ] **Step 1: Write a failing administrator component test**

```tsx
it('starts the deterministic offline run and shows one failing case detail', async () => {
  const user = userEvent.setup();
  render(<AdminPage client={client} />);
  await user.click(await screen.findByRole('button', { name: '运行离线评估' }));
  expect(await screen.findByText('6 / 6 通过')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '查看失败用例' }));
  expect(await screen.findByText('未引用预期知识来源：退款说明。')).toBeInTheDocument();
});
```

The production change this test must catch is a UI that only starts a run but does not refresh the summary or render the selected case's expected versus observed behavior.

- [ ] **Step 2: Run the web test and verify it fails**

Run: `npm run test --workspace @smart-cs/web -- test/AdminPage.test.tsx`

Expected: FAIL because `AdminApi` has no evaluation methods and the controls are absent.

- [ ] **Step 3: Add typed API methods and render the Evaluation Center**

```tsx
<button onClick={() => void start('offline')} disabled={running}>运行离线评估</button>
<button className="secondary" onClick={() => void start('real')} disabled={running}>运行真实 DeepSeek 评估</button>
<p>离线模式为确定性执行，不会调用模型。真实模式会调用 DeepSeek，可能消耗额度。</p>
```

After `runEvaluation`, prepend the returned summary to history, select its detail, and show total/pass/fail/elapsed time. Render question, expected outcome/source/tool/handoff reason, observed outcome/citations/tools/handoff reason, pass/fail indicator, and safe failure reason. On request failure show `评估运行失败，请稍后重试。`; do not render raw errors.

- [ ] **Step 4: Run the focused web test and verify it passes**

Run: `npm run test --workspace @smart-cs/web -- test/AdminPage.test.tsx`

Expected: PASS with the default offline control, updated summary, and failure detail.

- [ ] **Step 5: Commit the administrator UI**

```bash
git add apps/web/src/app/api.ts apps/web/src/components/EvaluationCenter.tsx apps/web/src/pages/AdminPage.tsx apps/web/src/styles.css apps/web/test/AdminPage.test.tsx
git commit -m "feat: add evaluation center to admin"
```

### Task 6: Verify the complete feature and document local use

**Files:**
- Modify: `README.md`
- Test: `apps/api/test/*.test.ts`
- Test: `apps/web/test/*.test.tsx`

**Interfaces:**
- Documents that `/admin` defaults to offline deterministic evaluation and real mode needs the existing `DEEPSEEK_API_KEY` server configuration.

- [ ] **Step 1: Write the concise operator documentation**

```md
### Agent evaluation

Open `/admin`, choose **运行离线评估** for the six deterministic fixtures, then select a run to inspect behavior. **运行真实 DeepSeek 评估** is opt-in, uses the server-only `DEEPSEEK_API_KEY`, and may consume model quota.
```

- [ ] **Step 2: Run all tests and type/build checks**

Run: `npm test && npm run build`

Expected: all API and web tests pass; both TypeScript builds pass without network access.

- [ ] **Step 3: Inspect the finished diff and test mutation coverage**

Run: `git diff master...HEAD --check && git status --short --branch`

Expected: no whitespace errors; only evaluation-center changes are present. Confirm each realistic mutation (wrong mode, absent citation, skipped tool, wrong handoff reason, thrown case, and UI refresh omission) is caught by at least one test.

- [ ] **Step 4: Commit verification documentation**

```bash
git add README.md
git commit -m "docs: explain agent evaluation workflow"
```

## Plan Self-Review

- **Spec coverage:** Task 1 covers behavior-only scoring and customer-request handoff. Task 2 supplies three SQLite tables and the six fixtures. Task 3 isolates per-case databases, provides offline/real adapters, safe failures, and no-network tests. Task 4 provides every specified API route and validation. Task 5 provides the admin controls, history, detail view, default offline copy, and real-mode quota warning. Task 6 verifies and documents operation.
- **Placeholder scan:** Every task contains concrete implementation and verification instructions. Each test and implementation step names exact files, observable contracts, commands, and expected outcomes.
- **Type consistency:** `EvaluationCase`, `EvaluationObservation`, `EvaluationRun`, `EvaluationResult`, `EvaluationRepository`, and `EvaluationRunner` flow consistently from contracts through persistence, runner, routes, and `AdminApi`.
