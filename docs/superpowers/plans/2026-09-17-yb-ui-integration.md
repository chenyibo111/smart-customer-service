# YB UI Integration Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Apply the YB UI design system to reusable controls across customer chat, the agent workbench, and the administrator console without changing service behavior.

**Architecture:** Keep npm as the package manager and install the design-system packages only in @smart-cs/web. Establish tokens, library CSS, and the Chinese YBProvider once in main.tsx; then migrate semantic controls in the three pages while leaving message rendering, routing, API clients, and state transitions unchanged.

**Tech Stack:** npm workspaces, React 19, TypeScript, Vite, Vitest, Testing Library, @chenyibo111/ui 0.1.0, @chenyibo111/tokens 0.1.0, @chenyibo111/icons 0.1.0.

**Spec:** docs/superpowers/specs/2026-09-17-yb-ui-integration-design.md

## Global Constraints

- Keep npm and root package-lock.json as the sole dependency lock; do not add pnpm files.
- Add the three YB packages to @smart-cs/web production dependencies only.
- Import Token CSS before UI CSS, and wrap the existing application with YBProvider configured with zhCN.
- Preserve every API URL, payload, state transition, accessible label, submit action, and disabled state.
- Do not add a theme switcher, custom icon assets, backend changes, or content from the Agent Evaluation Center branch.
- Test accessible, user-visible behavior; never test library class names or private DOM structure.

---

## File Structure

- package.json and package-lock.json: retain the npm workspace and lock all installed versions.
- apps/web/package.json: declare the three YB packages for the web app.
- apps/web/src/main.tsx: the sole global CSS and provider boundary.
- apps/web/src/components/ChatComposer.tsx: customer message field and send action.
- apps/web/src/components/TicketQueue.tsx: queued-ticket card, status, empty state, and claim action.
- apps/web/src/components/DocumentUploader.tsx: administration import fields and submit action.
- apps/web/src/components/TraceTimeline.tsx: replay cards and empty states.
- apps/web/src/pages/ChatPage.tsx, AgentPage.tsx, and AdminPage.tsx: page-level actions and state feedback.
- apps/web/src/styles.css: application layout plus YB Token variables, without resetting library component styles.
- apps/web/test/ChatPage.test.tsx, AgentPage.test.tsx, and AdminPage.test.tsx: unchanged behavioral regression boundary.

### Task 1: Establish the npm design-system boundary

**Files:**
- Modify: package.json, package-lock.json, apps/web/package.json
- Modify: apps/web/src/main.tsx
- Test: existing apps/web/test/*.test.tsx

**Interfaces:**
- Consumes: npm workspace name @smart-cs/web and the current React root.
- Produces: YB styles and YBProvider available to every existing route.

- [ ] **Step 1: Capture the current web regression baseline**

Run: npm run test --workspace @smart-cs/web

Expected: the current three page tests pass. No new test belongs to this setup step: stylesheet imports and a provider have no independent customer-service behavior beyond compiling and preserving existing interactions.

- [ ] **Step 2: Install published dependencies only in the web workspace**

Run:

    npm install --workspace @smart-cs/web @chenyibo111/ui@0.1.0 @chenyibo111/tokens@0.1.0 @chenyibo111/icons@0.1.0

Expected: apps/web/package.json declares all packages and the root package-lock.json resolves their transitive dependencies. Do not create pnpm-lock.yaml or pnpm-workspace.yaml.

- [ ] **Step 3: Add the styles and provider at the application root**

Modify apps/web/src/main.tsx to use this structure:

    import { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import { YBProvider, zhCN } from '@chenyibo111/ui';
    import { AppRouter } from './app/router.js';
    import '@chenyibo111/tokens/styles.css';
    import '@chenyibo111/ui/styles.css';
    import './styles.css';

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <YBProvider locale={zhCN}>
          <AppRouter />
        </YBProvider>
      </StrictMode>,
    );

- [ ] **Step 4: Verify the boundary**

Run:

    npm run test --workspace @smart-cs/web
    npm run build --workspace @smart-cs/web

Expected: all existing page interactions pass and Vite resolves the provider and stylesheets.

- [ ] **Step 5: Commit the setup**

    git add package.json package-lock.json apps/web/package.json apps/web/src/main.tsx
    git commit -m "feat: add YB UI application boundary"

### Task 2: Migrate customer-chat controls without changing streaming

**Files:**
- Modify: apps/web/src/components/ChatComposer.tsx
- Modify: apps/web/src/pages/ChatPage.tsx
- Modify: apps/web/src/styles.css
- Test: apps/web/test/ChatPage.test.tsx

**Interfaces:**
- Consumes: ChatComposer props disabled: boolean and onSend(content: string): Promise<void>; the existing CustomerApi.
- Produces: the same textbox named 输入问题; the same 发送 and 转人工 actions; and unchanged stream, citation, and handoff state transitions.

- [ ] **Step 1: Confirm the customer regression contract**

Run: npm run test --workspace @smart-cs/web -- ChatPage.test.tsx

Expected: the current test proves a user can type through the accessible textbox, submit 发送, and receive streamed answer text and source labels. Retain it because it guards behavior rather than component-library markup.

- [ ] **Step 2: Replace native controls with semantic YB controls**

In ChatComposer.tsx, import Button and Textarea from @chenyibo111/ui. Keep the form handler, id customer-message, label, placeholder, and trim logic unchanged. Replace the native controls with:

    <Textarea
      id="customer-message"
      className="chat-composer-textarea"
      value={content}
      disabled={disabled}
      onChange={(event) => setContent(event.target.value)}
      placeholder="例如：订单 A1001 到哪了？"
    />
    <Button type="submit" disabled={disabled || !content.trim()}>
      发送
    </Button>

In ChatPage.tsx, import Alert and Button. Render the existing notice through Alert while retaining role status. Replace only the handoff control with:

    <Button
      type="button"
      variant="secondary"
      onClick={() => void requestHandoff()}
      disabled={!conversationId || handoff}
    >
      转人工
    </Button>

Do not alter the for-await streaming loop or message state updates.

- [ ] **Step 3: Limit customer CSS to application layout**

Delete global button and native textarea skins that would override the library. Retain chat layout and add only:

    .chat-composer-textarea { min-height: 68px; }

Leave message bubbles, citations, and stream text purpose-built; replace compatible repeated literal colors with matching --yb-* Token variables only.

- [ ] **Step 4: Verify and commit the customer migration**

Run:

    npm run test --workspace @smart-cs/web -- ChatPage.test.tsx
    npm run build --workspace @smart-cs/web

Expected: the customer flow remains operable through accessible controls and the web app builds.

    git add apps/web/src/components/ChatComposer.tsx apps/web/src/pages/ChatPage.tsx apps/web/src/styles.css apps/web/test/ChatPage.test.tsx
    git commit -m "feat: apply YB UI to customer chat controls"

### Task 3: Migrate the agent queue and active-ticket controls

**Files:**
- Modify: apps/web/src/components/TicketQueue.tsx
- Modify: apps/web/src/pages/AgentPage.tsx
- Modify: apps/web/src/styles.css
- Test: apps/web/test/AgentPage.test.tsx

**Interfaces:**
- Consumes: TicketQueue props tickets: Ticket[] and onClaim(ticketId: string): Promise<void>, plus the existing StaffApi.
- Produces: the same 接管, 发送回复, and 关闭工单 actions and the same ticket lifecycle.

- [ ] **Step 1: Confirm the agent regression contract**

Run: npm run test --workspace @smart-cs/web -- AgentPage.test.tsx

Expected: the existing test covers ticket claim, context display, the labelled 人工回复 field, and reply submission. It remains the regression test because a component-library swap should not create a new workflow.

- [ ] **Step 2: Migrate queued-ticket presentation**

In TicketQueue.tsx, import Badge, Button, Card, CardContent, and Empty from @chenyibo111/ui. Replace the empty paragraph with Empty showing 当前没有待接管工单。. For each existing ticket, retain ticket.id as the React key, show the existing reason in a Card/CardContent, show a status Badge, and retain the exact action:

    <Button onClick={() => void onClaim(ticket.id)}>接管</Button>

- [ ] **Step 3: Migrate active-ticket feedback and reply controls**

In AgentPage.tsx, import Alert, Button, Card, CardContent, Empty, Field, Spinner, and Textarea from @chenyibo111/ui. Keep all API calls and promise chains unchanged. Use Alert for notices, Spinner plus the current 正在加载会话上下文… text while context is unavailable, and Field around the labelled reply input. The action portion must remain:

    <Textarea
      aria-label="人工回复"
      value={content}
      onChange={(event) => setContent(event.target.value)}
    />
    <Button type="submit">发送回复</Button>
    <Button variant="secondary" onClick={() => void client.closeTicket(ticket.id).then(onClosed)}>
      关闭工单
    </Button>

- [ ] **Step 4: Update CSS and verify**

Remove native ticket, active-ticket, and textarea visual skins now owned by cards and controls. Preserve spacing, message placement, and responsive layout; convert compatible container and muted-text literals to Tokens.

Run:

    npm run test --workspace @smart-cs/web -- AgentPage.test.tsx
    npm run build --workspace @smart-cs/web

Expected: all ticket behavior remains intact and the compiled web app succeeds.

- [ ] **Step 5: Commit the agent migration**

    git add apps/web/src/components/TicketQueue.tsx apps/web/src/pages/AgentPage.tsx apps/web/src/styles.css apps/web/test/AgentPage.test.tsx
    git commit -m "feat: apply YB UI to agent workbench"

### Task 4: Migrate administrator controls and operational states

**Files:**
- Modify: apps/web/src/components/DocumentUploader.tsx
- Modify: apps/web/src/components/TraceTimeline.tsx
- Modify: apps/web/src/pages/AdminPage.tsx
- Modify: apps/web/src/styles.css
- Test: apps/web/test/AdminPage.test.tsx

**Interfaces:**
- Consumes: DocumentUploader onImport({ title, markdown }): Promise<void> and the existing AdminApi.
- Produces: the same labelled knowledge fields, import action, conversation selector, source list, and replay information.

- [ ] **Step 1: Confirm the administrator regression contract**

Run: npm run test --workspace @smart-cs/web -- AdminPage.test.tsx

Expected: the current test finds indexed knowledge, selects a conversation with its accessible button name, and sees replay message and tool-call content.

- [ ] **Step 2: Migrate knowledge-import fields**

In DocumentUploader.tsx, import Button, Field, Input, and Textarea from @chenyibo111/ui. Retain the trim-and-submit handler exactly. Render visible Field labels and preserve aria-label 知识标题 and aria-label Markdown 内容. Use:

    <Button type="submit">导入并索引</Button>

- [ ] **Step 3: Migrate status and replay presentation**

In AdminPage.tsx, import Alert, Badge, Button, Card, CardContent, Empty, and Spinner. Use Alert for notices; Card/CardContent for document and conversation rows; Badge for indexStatus; Empty for absent documents/conversations; and Button variant secondary for replay selection. Preserve the existing accessible replay label that includes the visitor name. Do not change refresh, selectConversation, or importDocument.

In TraceTimeline.tsx, import Card, CardContent, and Empty. Use cards for replay items and Empty for each current no-data condition; keep every tool-call code value and Chinese text unchanged.

- [ ] **Step 4: Restrict admin CSS to layout and verify**

Remove native input, textarea, list-row, and trace-row skins replaced by library components. Retain admin-grid and its responsive behavior. Use Tokens only for remaining application-specific layout colors.

Run:

    npm run test --workspace @smart-cs/web -- AdminPage.test.tsx
    npm run build --workspace @smart-cs/web

Expected: administrator-visible behavior remains intact and the bundle compiles.

- [ ] **Step 5: Commit the admin migration**

    git add apps/web/src/components/DocumentUploader.tsx apps/web/src/components/TraceTimeline.tsx apps/web/src/pages/AdminPage.tsx apps/web/src/styles.css apps/web/test/AdminPage.test.tsx
    git commit -m "feat: apply YB UI to admin controls"

### Task 5: Verify the full workspace and record existing E2E availability

**Files:**
- Modify: README.md only if dependency instructions prove inaccurate.
- Test: all API and web suites.

**Interfaces:**
- Consumes: migrated web controls and unchanged backend contracts.
- Produces: verified npm dependency resolution and a clear record of verification evidence.

- [ ] **Step 1: Run complete tests and build**

Run:

    npm test
    npm run build

Expected: both workspaces pass their available tests and build without a DeepSeek key or network request.

- [ ] **Step 2: Run the configured E2E command**

Run: npm run e2e

Expected: if an e2e configuration and test files are present, the command passes against its required local services. If they remain absent, record the failure as an existing test-infrastructure gap; do not add browser coverage or alter the root script in this UI-only task.

- [ ] **Step 3: Inspect the final diff**

Run:

    git status --short
    git diff --check master...HEAD

Expected: no whitespace errors, no pnpm config/lock files, no backend API changes, and only intended frontend/dependency/test/documentation changes.

- [ ] **Step 4: Commit an instruction correction only when needed**

If README.md changed:

    git add README.md
    git commit -m "docs: clarify npm setup for YB UI"

