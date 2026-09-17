# YB UI Integration Design

## Goal

Introduce the `@chenyibo111` design system into the web customer-service application while preserving its existing customer, agent, and administrator workflows. The integration is intended to make the project a practical learning example for applying a component library to an Agent-based product without turning a visual refresh into a business-logic rewrite.

## Scope

The web workspace will install `@chenyibo111/ui`, `@chenyibo111/tokens`, and `@chenyibo111/icons` with npm. It will load the library's Token and component styles at the application boundary, and provide the library context through `YBProvider`.

The following existing visual primitives will migrate to the library:

- Action controls use `Button`.
- Customer, agent, and administration text entry uses `Input`, `Textarea`, and `Field` where applicable.
- Repeated containers and statuses use `Card`, `Badge`, `Alert`, `Empty`, and `Spinner`.
- The limited icon package is used only for icons it exports: add, close, loading, calendar, check, alert, and directional chevrons.

The following remain purpose-built:

- Chat message bubbles, streaming message presentation, and the trace timeline.
- Customer chat, agent workbench, and admin page layout.
- API clients, routing, event handling, and all conversation, ticket, and knowledge-base data flows.

This work does not add theme switching, create custom icon assets, restructure information architecture, change backend APIs, or merge the separate Agent Evaluation Center branch.

## Package Management

The repository remains an npm workspace. The root `package-lock.json` remains the only lockfile; no `pnpm-workspace.yaml` or `pnpm-lock.yaml` is created.

The three YB packages are declared as production dependencies of `@smart-cs/web` using npm's workspace-targeted installation. Their published peer range supports the app's React 19 version. The package manager must update the existing root lockfile so local and CI dependency resolution remain identical.

## Application Boundary

`apps/web/src/main.tsx` is the sole integration boundary for provider and global library CSS. It imports the Token stylesheet before the component stylesheet, then wraps the existing React application with `YBProvider` configured with the Chinese locale.

The current `styles.css` remains responsible for application-specific layout and chat visuals. It may replace hard-coded repeated colors, spacing, borders, and radii with YB Token custom properties where that makes the rule clearer, but it must not reset or override the component library's base component styles.

## Component Mapping

### Customer Chat

The chat composer uses the library text area and primary button for message submission. Handoff and retry-related customer actions use the appropriate semantic button variants. Message bubbles and streaming states retain their existing custom rendering.

### Agent Workbench

Ticket cards and status signals use `Card` and `Badge`. Claim, reply, and close actions use buttons with clear variants. The agent reply field uses `Textarea` and `Field`. Empty queues, loading transitions, and failed operations use `Empty`, `Spinner`, and `Alert`.

### Administrator Console

Knowledge-import and configuration entry controls use `Input`, `Textarea`, `Field`, and `Button`. Document and operational status presentation uses `Card`, `Badge`, `Alert`, `Empty`, and `Spinner`. No new admin function is introduced.

## Behavior and Error Handling

The presentation layer preserves all existing request URLs, request and response shapes, local state transitions, validation messages, and action semantics. Swapping a native element for a design-system component must retain its accessible label, submit behavior, disabled state, and keyboard interaction.

Existing server and network errors remain sourced from current API code. Pages render them with the YB `Alert` component without exposing additional technical information. Loading and empty states communicate the existing view state only; they do not create new asynchronous behavior or retries.

If an exported UI component or its stylesheet proves incompatible at compile time, the implementation uses the smallest compatible library primitive or keeps the current application-specific element for that case. It must not change backend contracts to accommodate a visual component.

## Testing and Acceptance Criteria

Existing web tests are updated only where control semantics change. They assert user-observable behavior through accessible roles and labels, including form entry, disabled/enabled submit actions, and ticket actions; they do not assert library class names or internal DOM structure.

The implementation is accepted when:

- `@smart-cs/web` declares all three YB packages and the root npm lockfile resolves them.
- The application root loads Token and UI styles and supplies `YBProvider` with Chinese locale.
- Customer, agent, and admin pages visibly use the mapped controls while their existing data flows work unchanged.
- Relevant web tests, the full workspace test suite, the production web build, and existing end-to-end checks pass when their required local services are available.
