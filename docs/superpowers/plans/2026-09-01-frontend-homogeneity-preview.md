# DigiHunt Frontend Homogeneity and Preview System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the `theming.png` identity consistently across the DigiHunt frontend, preserve the landing banner, and add safe development-only fixture previews for participant phases.

**Architecture:** Shared event primitives and typed phase presentation components form the visual layer. Production controllers continue using authentication, REST, polling, and WebSockets, while development preview routes feed the same presentation components synthetic fixtures. Vitest and Testing Library cover state rendering and interactions; Playwright covers deterministic preview screenshots and real integration paths.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library, Playwright, ESLint

---

## Milestone 1: Foundation and test harness

### Task 1: Commit the authoritative theme reference

**Files:**
- Add: `theming.png`
- Modify: `docs/superpowers/specs/2026-09-01-frontend-homogeneity-preview-design.md`

- [ ] Confirm `theming.png` is 1100×624 and visually contains KH Interference, near-black, off-white, and `#C8FF00`.
- [ ] Add a relative Markdown reference to `../../../theming.png` under “Reference fidelity.”
- [ ] Run `git diff --check`.
- [ ] Commit with `docs: add frontend theme reference`.

### Task 2: Add frontend component and browser test infrastructure

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/test/setup.ts`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/test/smoke.test.tsx`

- [ ] Install `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and `@playwright/test` as development dependencies.
- [ ] Add scripts: `test`, `test:watch`, `test:e2e`, and `test:e2e:update`.
- [ ] Configure Vitest for `jsdom`, the `@/` alias, globals, and `test/setup.ts`.
- [ ] Configure setup to import `@testing-library/jest-dom/vitest` and restore mocks after each test.
- [ ] Add a failing smoke test that imports a not-yet-created `SectionMarker` and asserts its label and index.
- [ ] Run `npm test -- --run`; expect failure because `@/components/event/section-marker` does not exist.
- [ ] Commit the red test and test infrastructure with `test(frontend): add component and browser harness`.

### Task 3: Establish exact theme tokens and global behavior

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`
- Test: `frontend/test/theme.test.ts`

- [ ] Add a failing source-level test asserting `globals.css` defines `--event-lime: #c8ff00`, event surface/foreground/border roles, square radius, focus-visible treatment, and reduced-motion handling.
- [ ] Run the theme test and verify it fails on the missing exact token.
- [ ] Refactor `globals.css` so shadcn-compatible variables reference explicit event tokens. Retain a subtle grid, remove excessive glow, and add reusable page-gutter, hard-rule, pixel-marker, focus, and reduced-motion utilities.
- [ ] Keep KH Interference local fonts and JetBrains Mono in `layout.tsx`; ensure body copy defaults to KH Interference while `.font-mono-data` remains technical-only.
- [ ] Run the theme test, lint, and build.
- [ ] Commit with `style(frontend): establish event theme tokens`.

### Task 4: Build shared event primitives

**Files:**
- Create: `frontend/components/event/event-shell.tsx`
- Create: `frontend/components/event/event-header.tsx`
- Create: `frontend/components/event/section-marker.tsx`
- Create: `frontend/components/event/event-panel.tsx`
- Create: `frontend/components/event/status-strip.tsx`
- Create: `frontend/components/event/progress-rail.tsx`
- Create: `frontend/components/event/data-label.tsx`
- Create: `frontend/components/event/async-state.tsx`
- Modify: `frontend/components/ui/button.tsx`
- Test: `frontend/test/event-primitives.test.tsx`

- [ ] Extend the red smoke test into focused tests for semantic headings, active progress `aria-current`, status text plus non-color indicator, panel variants, and keyboard-visible buttons.
- [ ] Run tests and confirm failures identify the missing primitives.
- [ ] Implement small typed primitives with `className` composition and no route-specific data fetching.
- [ ] Normalize button variants to primary lime fill, secondary hard outline, quiet text action, and destructive action without rounded corners or generic glow.
- [ ] Run component tests, lint, and build.
- [ ] Commit with `feat(frontend): add shared event interface primitives`.

## Milestone 2: Access and mission control

### Task 5: Create a homogeneous access shell for login and registration

**Files:**
- Create: `frontend/components/event/access-shell.tsx`
- Create: `frontend/components/auth/login-form.tsx`
- Create: `frontend/components/auth/register-form.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/register/page.tsx`
- Test: `frontend/test/access-pages.test.tsx`

- [ ] Write tests for labels, validation feedback, submitting state, invalid credentials, keyboard submission, and the asymmetric event-branding region.
- [ ] Confirm the tests fail against the current centered-card pages.
- [ ] Extract form presentation and callbacks from route logic.
- [ ] Build an asymmetric access shell using shared primitives, hard rules, large event typography, and no generic floating card.
- [ ] Preserve `autoComplete`, input labels, error semantics, and existing API behavior.
- [ ] Run tests, lint, build, and a mobile screenshot at 375px.
- [ ] Commit with `feat(frontend): unify login and registration experience`.

### Task 6: Refactor the participant dashboard into a mission index

**Files:**
- Create: `frontend/features/dashboard/dashboard-view.tsx`
- Create: `frontend/features/dashboard/dashboard-fixtures.ts`
- Modify: `frontend/app/dashboard/page.tsx`
- Test: `frontend/test/dashboard-view.test.tsx`

- [ ] Define a typed `DashboardViewModel` containing team identity, members, round states, current mission, and presence.
- [ ] Write failing tests for locked, active, and completed rounds and the single next-action hierarchy.
- [ ] Extract API/WebSocket transformation into the production route and render `DashboardView`.
- [ ] Compose rounds as a connected progression sequence rather than uniform cards.
- [ ] Keep presence and codes secondary and monospace-only.
- [ ] Run tests, lint, and build.
- [ ] Commit with `feat(frontend): redesign participant mission control`.

## Milestone 3: Development-only preview framework

### Task 7: Add the preview guard, toolbar, fixtures, and index

**Files:**
- Create: `frontend/lib/dev-preview.ts`
- Create: `frontend/components/dev/preview-toolbar.tsx`
- Create: `frontend/app/dev/preview/layout.tsx`
- Create: `frontend/app/dev/preview/page.tsx`
- Create: `frontend/app/dev/preview/dashboard/page.tsx`
- Create: `frontend/.env.example`
- Test: `frontend/test/dev-preview.test.tsx`

- [ ] Write failing tests for disabled previews, enabled previews, known-state parsing, unknown-state fallback, and synthetic-only fixture metadata.
- [ ] Implement `devPreviewsEnabled()` and a finite `resolvePreviewState()` helper.
- [ ] Guard preview server routes with `notFound()` unless `NEXT_PUBLIC_ENABLE_DEV_PREVIEWS=true`.
- [ ] Build a visually separate toolbar with route links, state links, active fixture, reset, and screenshot-hide attribute.
- [ ] Document `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_ENABLE_DEV_PREVIEWS=false` in `frontend/.env.example`.
- [ ] Add dashboard preview rendering from typed fixtures with no API import.
- [ ] Run tests with the flag absent and enabled, then run build in both configurations.
- [ ] Commit with `feat(frontend): add guarded development previews`.

## Milestone 4: Participant phases

### Task 8: Extract and normalize Round 1 presentation

**Files:**
- Create: `frontend/features/round1/round1-view.tsx`
- Create: `frontend/features/round1/round1-types.ts`
- Create: `frontend/features/round1/round1-fixtures.ts`
- Modify: `frontend/app/round1/page.tsx`
- Create: `frontend/app/dev/preview/round1/page.tsx`
- Test: `frontend/test/round1-view.test.tsx`

- [ ] Define view states for loading, locked, available, teammate-claimed, answering, incorrect, solved progression, and complete access-key reveal.
- [ ] Write failing tests for each fixture and answer/release callbacks.
- [ ] Extract the current claim, polling, WebSocket, and mutation logic into the production controller.
- [ ] Implement one dominant clue workspace, shared phase header, progress rail, status strips, and accessible answer feedback.
- [ ] Ensure preview callbacks simulate local transitions without API calls.
- [ ] Run component tests and Playwright screenshots for every state at 375px and 1440px.
- [ ] Commit with `feat(frontend): unify Round 1 clue experience`.

### Task 9: Extract and normalize Round 2 presentation

**Files:**
- Create: `frontend/features/round2/round2-view.tsx`
- Create: `frontend/features/round2/round2-types.ts`
- Create: `frontend/features/round2/round2-fixtures.ts`
- Modify: `frontend/app/round2/page.tsx`
- Create: `frontend/app/dev/preview/round2/page.tsx`
- Test: `frontend/test/round2-view.test.tsx`

- [ ] Define locked, loading, investigating, teammate-claimed, incorrect, and complete dossier states.
- [ ] Write failing tests for evidence tabs, question actions, investigation summary, long logs, and keyboard navigation.
- [ ] Extract production data orchestration while keeping REST/WebSocket behavior unchanged.
- [ ] Implement the incident-dossier composition and remove the one-off gradient success treatment.
- [ ] Use monospace only for logs, code, timestamps, and compact metadata.
- [ ] Capture deterministic mobile and desktop screenshots for all fixtures.
- [ ] Commit with `feat(frontend): unify Round 2 investigation dossier`.

### Task 10: Extract and normalize the Master terminal

**Files:**
- Create: `frontend/features/master/master-view.tsx`
- Create: `frontend/features/master/master-types.ts`
- Create: `frontend/features/master/master-fixtures.ts`
- Modify: `frontend/app/master/page.tsx`
- Create: `frontend/app/dev/preview/master/page.tsx`
- Test: `frontend/test/master-view.test.tsx`

- [ ] Write failing tests for locked, ready, checking, failure, and success states, including focus restoration and live status.
- [ ] Extract API and WebSocket behavior into the production controller.
- [ ] Implement a restrained, high-pressure verification composition with large status typography and no fake terminal filler.
- [ ] Fix the inherited synchronous set-state-in-effect lint issue through controller restructuring rather than disabling the rule.
- [ ] Capture all fixture states at mobile and desktop widths.
- [ ] Commit with `feat(frontend): redesign Master transition terminal`.

### Task 11: Extract and normalize Round 3 presentation

**Files:**
- Create: `frontend/features/round3/round3-view.tsx`
- Create: `frontend/features/round3/round3-types.ts`
- Create: `frontend/features/round3/round3-fixtures.ts`
- Modify: `frontend/app/round3/page.tsx`
- Create: `frontend/app/dev/preview/round3/page.tsx`
- Test: `frontend/test/round3-view.test.tsx`

- [ ] Write failing tests for locked, empty, drag-over, uploading, submitted, replacement history, deadline, and error states.
- [ ] Extract file/API orchestration into the production controller.
- [ ] Implement a persistent case brief and dominant submission workshop using shared panels and status strips.
- [ ] Preserve input reset, file validation messages, version history, and API-confirmed success semantics.
- [ ] Test long file names, keyboard file selection, and mobile stacking.
- [ ] Commit with `feat(frontend): unify Round 3 submission workshop`.

## Milestone 5: Public and operational surfaces

### Task 12: Normalize the landing page without replacing the banner

**Files:**
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/components/boot-sequence.tsx`
- Test: `frontend/test/landing-page.test.tsx`

- [ ] Add tests/snapshots that protect the banner hierarchy, primary actions, and section order.
- [ ] Replace page-local section markers, rules, and button styles with shared primitives below the banner.
- [ ] Preserve the hero composition and copy hierarchy.
- [ ] Fix the inherited reduced-motion set-state lint error by deriving initial visibility safely and scheduling transitions outside synchronous effect execution.
- [ ] Verify 320px through 1440px, reduced motion, keyboard navigation, and no horizontal overflow.
- [ ] Commit with `style(frontend): harmonize landing sections with event system`.

### Task 13: Unify admin and judge operational shells

**Files:**
- Modify: `frontend/app/admin/layout.tsx`
- Modify: `frontend/app/judge/layout.tsx`
- Modify: `frontend/app/admin/page.tsx`
- Modify: `frontend/app/admin/teams/page.tsx`
- Modify: `frontend/app/admin/teams/[id]/page.tsx`
- Modify: `frontend/app/admin/submissions/page.tsx`
- Modify: `frontend/app/admin/settings/page.tsx`
- Modify: `frontend/app/judge/page.tsx`
- Modify: `frontend/app/judge/teams/[id]/page.tsx`
- Create: `frontend/components/event/operations-shell.tsx`
- Test: `frontend/test/operations-pages.test.tsx`

- [ ] Write tests for role labels, navigation, tables, empty states, destructive confirmations, review status, and scoring state.
- [ ] Implement one operations shell shared by admin and judge routes.
- [ ] Normalize tables, filters, team headers, status strips, settings forms, and action hierarchy.
- [ ] Keep role differences in content and permissions, not separate themes.
- [ ] Verify long names, empty datasets, narrow tablets, keyboard navigation, and destructive-action focus.
- [ ] Commit with `feat(frontend): unify admin and judge operations`.

## Milestone 6: Reliability and acceptance

### Task 14: Repair inherited lint errors and accessibility gaps

**Files:**
- Modify: `frontend/hooks/useTeamSocket.ts`
- Modify affected presentation/controller files
- Test: `frontend/test/use-team-socket.test.tsx`

- [ ] Write a failing hook test proving the latest callback receives socket events without ref access during render.
- [ ] Update callback refs inside an effect or use a stable event callback pattern compatible with React 19 lint rules.
- [ ] Resolve all remaining `react-hooks/set-state-in-effect` issues through derived state, initializers, or asynchronous subscriptions.
- [ ] Add live regions and focus management for answers, uploads, verification, and recoverable errors.
- [ ] Run `npm run lint`, `npm test -- --run`, and `npm run build`; require zero errors.
- [ ] Commit with `fix(frontend): satisfy React hooks and accessibility checks`.

### Task 15: Add deterministic visual regression coverage

**Files:**
- Create: `frontend/e2e/previews.spec.ts`
- Create: `frontend/e2e/landing.spec.ts`
- Add: `frontend/e2e/*.spec.ts-snapshots/*`

- [ ] Start Next.js with `NEXT_PUBLIC_ENABLE_DEV_PREVIEWS=true` through Playwright web-server configuration.
- [ ] Capture every documented preview state at 375×812 and 1440×1000.
- [ ] Hide the preview toolbar through its dedicated screenshot attribute.
- [ ] Add assertions for no horizontal overflow, visible focus, and reduced-motion rendering.
- [ ] Review baselines against `theming.png` and the preserved banner, rejecting generic cards, excessive glow, incorrect lime, and inconsistent typography.
- [ ] Commit approved baselines with `test(frontend): add phase visual regression coverage`.

### Task 16: Validate real frontend/backend workflows

**Files:**
- Modify only when acceptance failures identify defects.
- Update: `README.md`

- [ ] Start PostgreSQL, run `uv run alembic upgrade head`, seed demo data, start FastAPI, and start Next.js with previews disabled.
- [ ] Verify registration and participant login through the browser.
- [ ] Verify dashboard state, Round 1 claim/answer/team sync, Round 2 evidence and answers, Master verification, Round 3 upload/history, judge review, and admin pages.
- [ ] Confirm preview routes return 404 with the flag absent.
- [ ] Run `npm run lint`, `npm test -- --run`, `npm run test:e2e`, `npm run build`, and backend compilation.
- [ ] Update `README.md` with preview enablement and test commands.
- [ ] Run `git diff --check` and confirm only `PLANV2.md` remains unrelated/untracked.
- [ ] Commit with `docs: document frontend previews and validation`.

## Final acceptance criteria

- The exact acid lime is `#C8FF00` and KH Interference remains the identity font.
- Every route uses the same tokens, primitives, state language, geometry, and interaction hierarchy.
- The landing banner composition remains recognizable and protected by tests.
- Participant phases can be inspected in all important states without backend progression.
- Preview routes use synthetic data, make no API calls, and return 404 unless explicitly enabled.
- Production auth, REST, WebSocket, and upload behavior remains functional.
- Lint, tests, build, responsive screenshots, accessibility checks, and real integration workflows pass.
