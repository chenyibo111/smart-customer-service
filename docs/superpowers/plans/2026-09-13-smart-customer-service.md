# Smart Customer Service MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Web customer-service learning prototype with DeepSeek-powered answers, local RAG, a read-only order lookup tool, human handoff, and replayable Agent traces.

**Architecture:** An npm workspace contains a React/Vite client, a Fastify API, and shared domain types. The API owns SQLite persistence, local embeddings, RAG retrieval, DeepSeek function-calling orchestration, SSE, and staff/admin operations; the client supplies `/chat`, `/agent`, and `/admin` workspaces.

**Tech Stack:** TypeScript, React, Vite, Fastify, SQLite with `better-sqlite3`, Zod, OpenAI-compatible SDK for DeepSeek, `@huggingface/transformers` for local embeddings, Vitest, Playwright.

**Spec:** `D:\AI\smart-customer-service\docs\superpowers\specs\2026-09-13-smart-customer-service-design.md`

## Global Constraints

- Create the independent project in `D:\AI\smart-customer-service`.
- Use DeepSeek only through server-side environment variables: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL`; never return the key to a browser or save it in SQLite.
- Use local Chinese embeddings and in-process cosine similarity; do not add a hosted vector database.
- Keep `query_order` read-only and use only seeded demo order data.
- Once a conversation reaches `waiting_human` or `human_active`, the Agent must not generate another customer-facing reply.
- Persist conversation, message, ticket, document/chunk, Agent-run, retrieval-evidence, and tool-call records.
- Do not save hidden chain-of-thought or unmasked sensitive data in the replay data.
- Customer-visible failures must be concise and offer human handoff; server error details must not be exposed.

---

## File Structure

```text
smart-customer-service/
  package.json                         # npm workspace scripts
  .env.example                         # non-secret configuration template
  apps/
    api/
      src/
        app.ts                          # Fastify assembly
        server.ts                       # executable HTTP server
        config.ts                       # validated environment configuration
        db/{database.ts,migrate.ts,schema.sql,seed.ts}
        domain/{types.ts,conversation-state.ts}
        repositories/{conversation-repository.ts,knowledge-repository.ts,trace-repository.ts}
        knowledge/{chunker.ts,embedder.ts,retriever.ts}
        agent/{deepseek-client.ts,order-tool.ts,orchestrator.ts}
        routes/{conversations.ts,staff.ts,admin.ts}
      test/                             # API unit and integration tests
    web/
      src/
        app/{router.tsx,api.ts,events.ts}
        pages/{ChatPage.tsx,AgentPage.tsx,AdminPage.tsx}
        components/{MessageList.tsx,ChatComposer.tsx,TraceTimeline.tsx}
      test/                             # component tests
  packages/shared/src/domain.ts         # cross-app API payload types
  e2e/customer-service.spec.ts          # main Playwright flows
```

### Task 1: Bootstrap the workspace, configuration, and test runners

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Create: `apps/api/package.json`, `apps/api/src/config.ts`, `apps/api/test/config.test.ts`
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/main.tsx`
- Create: `packages/shared/package.json`, `packages/shared/src/domain.ts`

**Interfaces:**
- Produces `loadConfig(env): AppConfig`, where `AppConfig` contains `port`, `databasePath`, `deepseekApiKey`, `deepseekBaseUrl`, and `deepseekModel`.
- Produces workspace commands `npm run test`, `npm run dev`, `npm run build`, and `npm run e2e`.

- [ ] **Step 1: Write the failing configuration tests**

```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

it('rejects a missing DeepSeek key outside test mode', () => {
  expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('DEEPSEEK_API_KEY');
});

it('uses the OpenAI-compatible DeepSeek defaults', () => {
  const config = loadConfig({ NODE_ENV: 'test', DEEPSEEK_API_KEY: 'test-key' });
  expect(config.deepseekBaseUrl).toBe('https://api.deepseek.com');
  expect(config.deepseekModel).toBe('deepseek-v4-flash');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --workspace @smart-cs/api run test -- config.test.ts`

Expected: FAIL because the API workspace and `loadConfig` do not yet exist.

- [ ] **Step 3: Add npm workspaces, TypeScript, Vitest, and validated configuration**

```ts
export type AppConfig = {
  port: number;
  databasePath: string;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const key = env.DEEPSEEK_API_KEY;
  if (!key && env.NODE_ENV !== 'test') throw new Error('DEEPSEEK_API_KEY is required');
  return {
    port: Number(env.PORT ?? 3001),
    databasePath: env.DATABASE_PATH ?? './data/customer-service.sqlite',
    deepseekApiKey: key ?? 'test-key',
    deepseekBaseUrl: env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
    deepseekModel: env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
  };
}
```

Place only variable names and safe example values in `.env.example`; add `.env`, `data/`, `node_modules/`, `dist/`, and `.superpowers/` to `.gitignore`.

- [ ] **Step 4: Run unit tests and a production build**

Run: `npm run test && npm run build`

Expected: PASS with both workspaces type-checking and no client bundle containing `DEEPSEEK_API_KEY`.

- [ ] **Step 5: Commit the bootstrap**

```bash
git add package.json tsconfig.base.json .gitignore .env.example apps packages
git commit -m "chore: bootstrap smart customer service workspace"
```

### Task 2: Define shared domain contracts and SQLite persistence

**Files:**
- Create: `packages/shared/src/domain.ts`
- Create: `apps/api/src/db/schema.sql`, `apps/api/src/db/database.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/db/seed.ts`
- Create: `apps/api/src/repositories/conversation-repository.ts`, `apps/api/src/repositories/trace-repository.ts`
- Create: `apps/api/test/conversation-repository.test.ts`

**Interfaces:**
- Produces `ConversationStatus = 'ai_processing' | 'ai_replied' | 'waiting_human' | 'human_active' | 'resolved'`.
- Produces `ConversationRepository.create(visitorId)`, `appendMessage(input)`, `getById(id)`, and `listForAgent(statuses)`.
- Produces `TraceRepository.createRun(input)`, `recordEvidence(input)`, and `recordToolCall(input)`.

- [ ] **Step 1: Write failing persistence tests**

```ts
it('persists messages and a replayable tool-call trace', () => {
  const conversation = conversations.create('visitor-1');
  conversations.appendMessage({ conversationId: conversation.id, role: 'customer', content: 'A1001 到哪了？' });
  const run = traces.createRun({ conversationId: conversation.id, triggerMessageId: 1, model: 'test-model' });
  traces.recordToolCall({ runId: run.id, name: 'query_order', maskedArguments: '{"orderId":"A***1"}', result: 'shipped', status: 'succeeded' });
  expect(traces.getReplay(conversation.id).toolCalls).toHaveLength(1);
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run: `npm --workspace @smart-cs/api run test -- conversation-repository.test.ts`

Expected: FAIL because no schema or repository exists.

- [ ] **Step 3: Add schema, migrations, repositories, and seeded demo orders**

Create tables for `conversations`, `messages`, `tickets`, `knowledge_documents`, `knowledge_chunks`, `agent_runs`, `retrieval_evidence`, and `tool_calls`. Use foreign keys and ISO timestamps. Seed only fictitious orders such as `A1001` and `A2002`; include a `demo_orders` table with `id`, `status`, and `summary`.

```ts
export type AppendMessageInput = {
  conversationId: string;
  role: 'customer' | 'assistant' | 'agent' | 'system';
  content: string;
};
```

- [ ] **Step 4: Run repository tests and inspect a fresh database**

Run: `npm --workspace @smart-cs/api run test -- conversation-repository.test.ts`

Expected: PASS and the test database contains both the message and the masked tool trace.

- [ ] **Step 5: Commit persistence**

```bash
git add packages/shared apps/api/src/db apps/api/src/repositories apps/api/test/conversation-repository.test.ts
git commit -m "feat: add customer-service persistence and traces"
```

### Task 3: Implement the conversation state machine and human handoff

**Files:**
- Create: `apps/api/src/domain/conversation-state.ts`
- Create: `apps/api/test/conversation-state.test.ts`
- Modify: `apps/api/src/repositories/conversation-repository.ts`

**Interfaces:**
- Produces `transitionConversation(current, event): ConversationStatus`.
- Produces `requestHumanHandoff(conversationId, reason)` and `claimTicket(ticketId, agentId)`.
- Consumes the persistence interfaces from Task 2.

- [ ] **Step 1: Write failing state-machine tests**

```ts
it('does not allow the bot to resume after human handoff', () => {
  expect(transitionConversation('waiting_human', 'agent_reply_requested')).toBe('waiting_human');
  expect(transitionConversation('human_active', 'agent_reply_requested')).toBe('human_active');
});

it('creates a ticket and enters the queue on handoff', () => {
  const result = requestHumanHandoff('conversation-1', 'customer_requested');
  expect(result.status).toBe('waiting_human');
  expect(result.ticket.status).toBe('open');
});
```

- [ ] **Step 2: Run the state-machine test to verify it fails**

Run: `npm --workspace @smart-cs/api run test -- conversation-state.test.ts`

Expected: FAIL because transitions and handoff operations do not exist.

- [ ] **Step 3: Implement explicit transition rules and ticket ownership**

```ts
const blockedAgentStates = new Set<ConversationStatus>(['waiting_human', 'human_active']);

export function mayRunAgent(status: ConversationStatus): boolean {
  return !blockedAgentStates.has(status) && status !== 'resolved';
}
```

Allow only: customer message → `ai_processing`; successful assistant answer → `ai_replied`; handoff request → `waiting_human`; ticket claim → `human_active`; staff close → `resolved`.

- [ ] **Step 4: Run state-machine and repository tests**

Run: `npm --workspace @smart-cs/api run test -- conversation-state.test.ts conversation-repository.test.ts`

Expected: PASS, including the invariant that a staff-owned conversation cannot invoke the Agent.

- [ ] **Step 5: Commit the handoff workflow**

```bash
git add apps/api/src/domain apps/api/src/repositories apps/api/test/conversation-state.test.ts
git commit -m "feat: add conversation handoff state machine"
```

### Task 4: Build local knowledge indexing and retrieval

**Files:**
- Create: `apps/api/src/knowledge/chunker.ts`, `apps/api/src/knowledge/embedder.ts`, `apps/api/src/knowledge/retriever.ts`
- Create: `apps/api/src/repositories/knowledge-repository.ts`
- Create: `apps/api/test/retriever.test.ts`

**Interfaces:**
- Produces `chunkMarkdown(documentId, title, markdown): KnowledgeChunkDraft[]`.
- Produces `EmbeddingProvider.embed(texts): Promise<number[][]>`.
- Produces `Retriever.search(query, limit): Promise<RetrievedChunk[]>`.
- `RetrievedChunk` contains `chunkId`, `title`, `content`, `score`, and `sourceLabel`.

- [ ] **Step 1: Write failing chunking and ranking tests with a fake embedder**

```ts
const embedder: EmbeddingProvider = { embed: async (texts) => texts.map((text) => text.includes('退款') ? [1, 0] : [0, 1]) };

it('returns the most relevant indexed FAQ with its source label', async () => {
  await indexDocument({ title: '退款说明', markdown: '# 退款\n七日内可申请退款。' }, embedder);
  const results = await retriever.search('怎么退款', 3);
  expect(results[0]).toMatchObject({ title: '退款说明', sourceLabel: '退款说明' });
});
```

- [ ] **Step 2: Run the retrieval test to verify it fails**

Run: `npm --workspace @smart-cs/api run test -- retriever.test.ts`

Expected: FAIL because indexing and ranking functions do not exist.

- [ ] **Step 3: Implement document chunks, embedding abstraction, and cosine ranking**

Use a deterministic fake provider in tests and an `@huggingface/transformers`-backed provider in runtime. Implement `cosineSimilarity(a, b)` with equal-length validation. Store source title and content with each vector. Retrieve at most three chunks and make the score threshold configurable through `RAG_MIN_SCORE`.

- [ ] **Step 4: Run knowledge tests without loading the runtime model**

Run: `npm --workspace @smart-cs/api run test -- retriever.test.ts`

Expected: PASS using only the fake embedder; tests must not download a model.

- [ ] **Step 5: Commit RAG indexing and retrieval**

```bash
git add apps/api/src/knowledge apps/api/src/repositories/knowledge-repository.ts apps/api/test/retriever.test.ts
git commit -m "feat: add local knowledge retrieval"
```

### Task 5: Add the safe demo order tool and DeepSeek Agent adapter

**Files:**
- Create: `apps/api/src/agent/order-tool.ts`, `apps/api/src/agent/deepseek-client.ts`, `apps/api/src/agent/orchestrator.ts`
- Create: `apps/api/test/order-tool.test.ts`, `apps/api/test/orchestrator.test.ts`

**Interfaces:**
- Produces `queryOrder(input: { orderId: string }): Promise<{ orderId: string; status: string; summary: string }>`.
- Produces `AgentOrchestrator.respond(input): AsyncIterable<AgentEvent>`.
- `AgentEvent` is one of `token`, `citation`, `tool_call`, `handoff`, `completed`, or `failed`.
- Consumes `Retriever`, `ConversationRepository`, `TraceRepository`, and `mayRunAgent`.

- [ ] **Step 1: Write failing tests for tool validation and safe Agent behavior**

```ts
it('rejects malformed or unknown demo order IDs', async () => {
  await expect(queryOrder({ orderId: 'DROP TABLE' })).rejects.toThrow('invalid order ID');
  await expect(queryOrder({ orderId: 'A9999' })).rejects.toThrow('order not found');
});

it('hands off rather than fabricating an answer without retrieval evidence', async () => {
  const events = await collect(orchestrator.respond({ conversationId: 'c-1', message: '你们的线下门店在哪里？' }));
  expect(events.at(-1)).toMatchObject({ type: 'handoff', reason: 'insufficient_knowledge' });
});
```

- [ ] **Step 2: Run Agent tests to verify they fail**

Run: `npm --workspace @smart-cs/api run test -- order-tool.test.ts orchestrator.test.ts`

Expected: FAIL because the tool and orchestrator do not exist.

- [ ] **Step 3: Implement tool schemas, OpenAI-compatible DeepSeek calls, and orchestration**

Define the `query_order` JSON schema with a single uppercase `A` plus four digits identifier. Validate every model-supplied argument with Zod before database access. Pass retrieved source snippets only when above the threshold. Record masked arguments, tool result status, evidence, model name, elapsed milliseconds, and usage metadata. On unavailable evidence, missing key, upstream error, invalid tool arguments, or tool failure, persist a failed run and yield a handoff event with a customer-safe message.

```ts
const orderSchema = z.object({ orderId: z.string().regex(/^A\d{4}$/) });

export async function* respond(input: RespondInput): AsyncGenerator<AgentEvent> {
  if (!mayRunAgent(input.conversation.status)) return;
  // retrieve → model/tool loop → persist trace → yield SSE-ready events
}
```

- [ ] **Step 4: Run all Agent tests with a fake DeepSeek client**

Run: `npm --workspace @smart-cs/api run test -- order-tool.test.ts orchestrator.test.ts`

Expected: PASS; no test should make a network request or require a real key.

- [ ] **Step 5: Commit Agent orchestration**

```bash
git add apps/api/src/agent apps/api/test/order-tool.test.ts apps/api/test/orchestrator.test.ts
git commit -m "feat: add DeepSeek customer-service agent"
```

### Task 6: Expose HTTP, SSE, staff, and admin APIs

**Files:**
- Create: `apps/api/src/app.ts`, `apps/api/src/server.ts`
- Create: `apps/api/src/routes/conversations.ts`, `apps/api/src/routes/staff.ts`, `apps/api/src/routes/admin.ts`
- Create: `apps/api/test/routes.test.ts`

**Interfaces:**
- `POST /api/conversations` returns `{ conversation }`.
- `POST /api/conversations/:id/messages` streams `text/event-stream` Agent events.
- `POST /api/conversations/:id/handoff` returns `{ conversation, ticket }`.
- `GET /api/agent/tickets`, `POST /api/agent/tickets/:id/claim`, `POST /api/agent/tickets/:id/messages`, and `POST /api/agent/tickets/:id/close` implement staff actions.
- `POST /api/admin/documents`, `GET /api/admin/documents`, `GET /api/admin/conversations/:id/replay` implement administration.

- [ ] **Step 1: Write failing route tests**

```ts
it('returns a safe handoff when the Agent has no answer', async () => {
  const conversation = await app.inject({ method: 'POST', url: '/api/conversations', payload: { visitorId: 'v-1' } });
  const id = conversation.json().conversation.id;
  const response = await app.inject({ method: 'POST', url: `/api/conversations/${id}/handoff`, payload: { reason: 'customer_requested' } });
  expect(response.statusCode).toBe(200);
  expect(response.json().conversation.status).toBe('waiting_human');
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run: `npm --workspace @smart-cs/api run test -- routes.test.ts`

Expected: FAIL because no Fastify app or routes are registered.

- [ ] **Step 3: Assemble Fastify and map domain events to SSE**

Set `Content-Type: text/event-stream`, send named events as JSON, and close the stream only after a `completed`, `handoff`, or `failed` event. Validate request bodies with Zod. Return only customer-safe error payloads such as `{ code: 'SERVICE_UNAVAILABLE', message: '暂时无法处理，已为你转接人工客服。' }`; log detailed errors server-side without including secrets.

- [ ] **Step 4: Run API tests and start the server locally**

Run: `npm --workspace @smart-cs/api run test -- routes.test.ts && npm --workspace @smart-cs/api run dev`

Expected: Tests PASS; the API starts and exposes `/health` with `{ "ok": true }`.

- [ ] **Step 5: Commit API routes**

```bash
git add apps/api/src/app.ts apps/api/src/server.ts apps/api/src/routes apps/api/test/routes.test.ts
git commit -m "feat: expose customer-service API and streams"
```

### Task 7: Build the customer chat workspace

**Files:**
- Create: `apps/web/src/app/router.tsx`, `apps/web/src/app/api.ts`, `apps/web/src/app/events.ts`
- Create: `apps/web/src/pages/ChatPage.tsx`
- Create: `apps/web/src/components/MessageList.tsx`, `apps/web/src/components/ChatComposer.tsx`
- Create: `apps/web/src/styles.css`, `apps/web/test/ChatPage.test.tsx`

**Interfaces:**
- Consumes `POST /api/conversations`, `POST /api/conversations/:id/messages`, and `POST /api/conversations/:id/handoff`.
- Produces a visitor ID in browser storage and a conversation ID in session storage.
- Renders assistant citations, a visible handoff status, and no technical error details.

- [ ] **Step 1: Write failing customer-page tests**

```tsx
it('renders streamed answer text and source labels', async () => {
  render(<ChatPage client={fakeClientWithEvents([{ type: 'token', text: '可在七日内退款。' }, { type: 'citation', sourceLabel: '退款说明' }])} />);
  await userEvent.type(screen.getByRole('textbox'), '怎么退款？');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByText('可在七日内退款。')).toBeInTheDocument();
  expect(screen.getByText('退款说明')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the customer-page test to verify it fails**

Run: `npm --workspace @smart-cs/web run test -- ChatPage.test.tsx`

Expected: FAIL because the page and API client do not exist.

- [ ] **Step 3: Implement the chat page and SSE event consumer**

Render customer, assistant, staff, and system messages distinctly. Disable the composer while a response streams. When a `handoff` event arrives, show the queue status, keep the customer's subsequent messages visible, and do not initiate further Agent requests. Include a direct “转人工” button and a simple resolved-session rating control.

- [ ] **Step 4: Run client tests and build the web application**

Run: `npm --workspace @smart-cs/web run test -- ChatPage.test.tsx && npm --workspace @smart-cs/web run build`

Expected: PASS and a production bundle with no API key literals.

- [ ] **Step 5: Commit the customer workspace**

```bash
git add apps/web/src apps/web/test/ChatPage.test.tsx
git commit -m "feat: add streaming customer chat workspace"
```

### Task 8: Build the staff and administrator workspaces

**Files:**
- Create: `apps/web/src/pages/AgentPage.tsx`, `apps/web/src/pages/AdminPage.tsx`
- Create: `apps/web/src/components/TicketQueue.tsx`, `apps/web/src/components/TraceTimeline.tsx`, `apps/web/src/components/DocumentUploader.tsx`
- Create: `apps/web/test/AgentPage.test.tsx`, `apps/web/test/AdminPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`, `apps/web/src/app/api.ts`

**Interfaces:**
- Consumes every `/api/agent/*` route and the `/api/admin/*` routes from Task 6.
- `TraceTimeline` accepts `{ messages, runs, evidence, toolCalls, tickets }` from replay API responses.
- Produces the `/agent` and `/admin` routes with fixed demonstration identity badges.

- [ ] **Step 1: Write failing staff and admin component tests**

```tsx
it('lets a staff user claim a waiting ticket and sends a human message', async () => {
  render(<AgentPage client={fakeStaffClient()} />);
  await userEvent.click(await screen.findByRole('button', { name: '接管' }));
  expect(screen.getByText('人工处理中')).toBeInTheDocument();
});

it('shows evidence, tool calls, and handoff reason in a replay', async () => {
  render(<AdminPage client={fakeAdminClient()} />);
  expect(await screen.findByText('退款说明')).toBeInTheDocument();
  expect(screen.getByText('query_order')).toBeInTheDocument();
  expect(screen.getByText('customer_requested')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run staff and admin tests to verify they fail**

Run: `npm --workspace @smart-cs/web run test -- AgentPage.test.tsx AdminPage.test.tsx`

Expected: FAIL because pages and components do not exist.

- [ ] **Step 3: Implement ticket queue, handoff ownership, document import, and replay**

`AgentPage` polls or refreshes the waiting queue, claims a ticket, sends only human-role messages, and closes the ticket. `AdminPage` uploads Markdown/FAQ content, displays document indexing status, lists conversations, and passes replay data to `TraceTimeline`. Mask order IDs in the rendered trace using the same server-provided display value; never reconstruct unmasked data in the browser.

- [ ] **Step 4: Run component tests and the full frontend suite**

Run: `npm --workspace @smart-cs/web run test && npm --workspace @smart-cs/web run build`

Expected: PASS; all three routes render and type-check.

- [ ] **Step 5: Commit staff and admin workspaces**

```bash
git add apps/web/src apps/web/test/AgentPage.test.tsx apps/web/test/AdminPage.test.tsx
git commit -m "feat: add staff console and admin replay"
```

### Task 9: Add end-to-end coverage, operating documentation, and live verification

**Files:**
- Create: `e2e/customer-service.spec.ts`, `playwright.config.ts`
- Create: `README.md`, `docs/demo-fixtures/refund-policy.md`
- Modify: `.env.example`, `package.json`

**Interfaces:**
- Consumes the running API and client from Tasks 6–8.
- Produces reproducible commands for local setup, demo data indexing, testing, and a manual DeepSeek smoke test.

- [ ] **Step 1: Write failing end-to-end scenarios**

```ts
test('answers an FAQ with a citation, then hands off and allows staff ownership', async ({ page, context }) => {
  await page.goto('/chat');
  await page.getByRole('textbox').fill('怎么退款？');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByText('退款说明')).toBeVisible();
  await page.getByRole('button', { name: '转人工' }).click();
  await expect(page.getByText('等待客服接管')).toBeVisible();
  const staff = await context.newPage();
  await staff.goto('/agent');
  await staff.getByRole('button', { name: '接管' }).click();
  await expect(staff.getByText('人工处理中')).toBeVisible();
});
```

- [ ] **Step 2: Run the end-to-end test to verify it fails**

Run: `npm run e2e -- --grep "answers an FAQ"`

Expected: FAIL until the client, API, fixtures, and test web servers are wired together.

- [ ] **Step 3: Configure Playwright and document the complete local workflow**

Document: install dependencies; copy `.env.example` to `.env`; set `DEEPSEEK_API_KEY`; start API and web app; import `refund-policy.md`; run automated tests; and perform the manual real-key smoke test. The manual smoke test must verify a streamed DeepSeek reply, `A1001` tool call, unanswerable-question handoff, staff claim, and admin replay.

- [ ] **Step 4: Run the complete verification suite**

Run: `npm run test && npm run build && npm run e2e`

Expected: All unit, integration, component, and end-to-end tests PASS. Then run the documented real-key smoke test and confirm the server logs do not expose the key.

- [ ] **Step 5: Commit verification and documentation**

```bash
git add e2e playwright.config.ts README.md docs/demo-fixtures .env.example package.json
git commit -m "test: cover smart customer-service MVP flows"
```

## Plan Self-Review

### Spec coverage

- Real-time Web dialogue, DeepSeek, local RAG, citations, tool calls, human handoff, three workspaces, persistence, replay, safe failures, and tests map to Tasks 1–9.
- The explicit no-bot-after-handoff rule is implemented and tested in Task 3 and enforced again in Task 5 and Task 7.
- The stated out-of-scope features are omitted from all tasks.

### Consistency checks

- Shared status names are defined in Task 2 and used consistently through Tasks 3, 5, 6, and 8.
- The only business tool is consistently named `query_order` and uses `{ orderId: string }` in all tasks.
- All automated DeepSeek interactions use fakes; only the final manual smoke test requires a configured real key.
- No plan step requires a hosted vector database, real customer data, or client-side secret.
