# Agent Evaluation Center Design

## Goal

Add a local evaluation center that makes the customer-service Agent's observable behavior repeatable: retrieval source selection, safe order-tool use, answer versus human handoff, and failure handling.

## Scope

The first release supplies a fixed set of six learning-oriented cases, an offline deterministic mode, an opt-in real DeepSeek mode, persisted run history, and an administrator view of summaries and case-level results.

It does not compare answer wording, invoke external evaluation services, retry real model requests, or expose API keys, hidden reasoning, or raw upstream errors.

## Evaluation Contract

Each evaluation case stores:

- A human-readable name and customer question.
- Expected outcome: `answer` or `handoff`.
- Optional expected knowledge source label.
- Optional expected tool name, currently `query_order`.
- Optional expected handoff reason.

The initial fixture set covers refund answering, valid order `A1001` lookup, malformed order input, an unknown question, an explicit human-request scenario, and unavailable retrieval evidence.

An evaluation result passes only when every declared expected behavior matches the observed Agent events. Answer prose is shown for review but is not compared verbatim.

## Execution Architecture

Evaluation runs are isolated from customer operations. Each run creates an in-memory SQLite database, applies the existing schema, seeds only fictitious orders and evaluation knowledge, and creates fresh conversations. It never reads or writes customer conversations, tickets, or knowledge records.

Both modes invoke the real `AgentOrchestrator` and its state-machine/tool boundaries:

- **Offline mode** injects deterministic retrieval and model adapters. It runs in automated tests and validates orchestration and scoring without network access or a DeepSeek key.
- **Real mode** uses `LocalEmbeddingProvider` and the server-side `DeepSeekClient`. It runs only after an administrator explicitly requests it; the key remains server-only.

The runner extracts `token`, `citation`, `tool_call`, `handoff`, and `failed` events, measures elapsed milliseconds, applies the evaluation contract, and persists a summary plus per-case observations.

## Persistence

Three SQLite tables are added:

- `evaluation_cases`: immutable seeded case contract and fixture version.
- `evaluation_runs`: mode, lifecycle status, start/end timestamps, total count, pass count, and elapsed milliseconds.
- `evaluation_results`: the case/run relation, outcome, citations, tool names, handoff reason, elapsed milliseconds, pass flag, and a safe failure reason.

The stored observation contains no secret, hidden chain-of-thought, raw provider response, or unmasked order identifier.

## API

Administrative routes provide:

- `GET /api/admin/evaluations/cases` for available cases.
- `POST /api/admin/evaluations/runs` with `{ mode: 'offline' | 'real' }` to synchronously create and execute one run.
- `GET /api/admin/evaluations/runs` for summary history.
- `GET /api/admin/evaluations/runs/:id` for a run and ordered case results.

Missing configuration or a per-case runtime failure marks that case failed with a concise safe reason and continues the remaining cases. Request validation errors use the existing safe error shape.

## Administrator Experience

The existing `/admin` page receives an Evaluation Center section. It lets an administrator choose mode, start a run, inspect total/pass/fail counts and elapsed time, and select a historical run. The selected run lists each customer question, expected behavior, observed behavior, citation labels, tool calls, handoff reason, pass/fail status, and a safe failure reason.

Offline mode is the default and is labeled as deterministic. Real mode is visibly labeled as a DeepSeek call that may consume quota.

## Testing

- Unit tests cover event-to-observation extraction and every passing/failing rule.
- API integration tests execute an offline batch, verify persisted summaries and case results, and verify an invalid mode is rejected.
- Web component tests verify starting an offline run, its summary, and one failure detail.
- All automated tests use offline adapters and make no DeepSeek or embedding download request.
