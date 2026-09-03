# DigiHunt Overhaul Plan V2

> **Status:** Working document. Nothing here is sacred.
>
> This file records what we currently understand about the repository, what works, what is fragile, and what we want DigiHunt to become. Edit aggressively. Add complaints, ideas, constraints, and disagreements directly in the **Owner Notes** sections.

---

## 1. Why This Document Exists

DigiHunt is already a functional event platform, not an empty prototype. It supports team registration, authentication, three competition rounds, submissions, administration, judging, a Master Terminal, and team-scoped realtime updates.

The next step should not be random refactoring or a cosmetic reskin. We need to preserve the useful domain model while rebuilding weak boundaries, proving business rules with tests, improving the participant experience, and making the system safe to operate during a live event.

This document is the shared source of truth before implementation begins.

---

## 2. Current Product Understanding

### 2.1 Product concept

DigiHunt: **The Missing Code** is a story-driven technical competition for three-member teams.

The intended journey is:

1. Register a three-person team.
2. Complete Round 1 technical questions and recover code fragments.
3. Complete Round 2 incident-investigation questions.
4. Unlock Round 3, receive a case, and submit a PPTX solution.
5. Have the submission judged.
6. Recover and verify the Master Code.

The backend owns competition state and rule enforcement. The frontend presents the mission and coordinates participant, administrator, and judge workflows. PostgreSQL stores persistent event state. WebSockets deliver team-scoped updates.

### 2.2 Current stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/Base UI, Lucide icons.
- **Backend:** FastAPI, synchronous SQLAlchemy 2.0, Pydantic 2, Alembic, PostgreSQL, PyJWT, Argon2.
- **Storage:** PostgreSQL for structured state and local filesystem for PPTX uploads.
- **Realtime:** FastAPI WebSockets with JWT query authentication and origin checks.
- **Repository shape:** Separate `frontend/` and `backend/` applications with root documentation.

### 2.3 Main surfaces

#### Participant

- Landing page
- Team registration and login
- Team dashboard
- Round 1 board
- Round 2 investigation board
- Round 3 case and submission flow
- Master Terminal

#### Administrator

- Event dashboard
- Team listing and detail
- Submission management
- Event settings
- Master-code management
- Development/reset controls

#### Judge

- Assigned teams
- Team submission review
- Score submission and finalization

#### Realtime

- Question claimed, released, and solved
- Round progression and unlocks
- Submission changes
- Master Terminal unlock
- Member presence

---

## 3. What Already Works

We should preserve these strengths rather than rewrite everything blindly.

### 3.1 Coherent domain model

The repository models users, teams, questions, team-question assignments, attempts, case files, submissions, scores, event settings, and the Master Code. The concepts broadly match the product.

### 3.2 Functional end-to-end foundation

Verified through real services and an isolated PostgreSQL database:

- Alembic migration succeeds.
- Seed script runs.
- Landing and registration pages render in a browser.
- Team registration succeeds.
- Participant login and JWT authentication succeed.
- `/auth/me` and `/teams/me` return consistent identity and team state.
- Round access gates reject locked content.
- Concurrent claims allow one winner.
- Role checks protect administrator and judging routes.
- Judge assignment route works.
- Master-code rejection path works.
- WebSocket token and origin boundaries work.
- A valid participant WebSocket connection opens.
- Production frontend build succeeds and generates all 16 routes.
- Python sources compile and installed backend dependencies are consistent.
- `npm audit` reports no known vulnerabilities.

### 3.3 Sensible security intentions

The code avoids exposing question answers in participant response schemas, hashes passwords and the Master Code, derives WebSocket team identity server-side, checks WebSocket origins, rate-limits sensitive routes, and hides unhandled exception details.

### 3.4 Manageable repository size

The system is compact enough to improve incrementally. A controlled overhaul is preferable to a ground-up rewrite unless new requirements fundamentally invalidate the current model.

---

## 4. Confirmed Problems

### 4.1 Competition-rule integrity

#### Expired claims can still submit answers

Claim acquisition correctly permits another member to reclaim an expired question. However, the answer handler checks only `status == claimed` and `assigned_to == current user`; it does not validate `claim_expires_at`.

Observed behavior: after manually expiring a claim, the expired owner could still submit an answer and receive HTTP 200.

**Required outcome:** claim expiry must be enforced atomically for answering, solving, and releasing. Competition state transitions need explicit invariants and concurrency tests.

#### Seed state disagrees with runtime gates

The seed script describes DGH-001 as Round 1 and Round 2 complete, with a case and submission. The real API returned `Round 3 is locked` for case and submission endpoints.

**Required outcome:** seeded scenarios must be acceptance fixtures whose documented state matches what public APIs report.

#### Database invariants are too weak

Important single-row or current-row assumptions rely too heavily on application logic. Likely risk areas include:

- One current submission per team
- One finalized/current score per relevant team/judge relationship
- One assigned case per team
- Idempotent round/question assignment
- State transitions under concurrent requests

**Required outcome:** enforce invariants in PostgreSQL with unique or partial indexes, constraints, transactions, and migrations. Application checks should improve error messages, not be the only protection.

### 4.2 Submission storage lifecycle

Uploads combine filesystem writes and database commits without a real transaction spanning both systems.

Possible failures:

- File written but database commit fails
- Database row written but file missing
- Replacement marks an old row non-current while the new file operation fails
- Administrative resets delete database state but leave orphaned files
- Multiple workers race on version numbers or current-submission state

**Required outcome:** define a storage abstraction and a recoverable upload protocol. At minimum, use temporary writes, validation, atomic rename, DB constraints, compensation cleanup, and reconciliation tooling. Prefer object storage for deployed environments.

### 4.3 Authentication and authorization boundaries

Current authentication works, but the lifecycle is thin:

- JWTs are stored in `localStorage`, increasing exposure to XSS.
- There is no refresh-token or session-revocation model.
- Account/team status enforcement is not clearly centralized.
- Roleless route failures can produce misleading errors. A judge calling `/teams/me` receives `404 no team for this user` rather than a role-appropriate denial.
- Seeded administrators do not exist, making complete operational acceptance testing awkward.

**Required outcome:** choose and document a session model, centralize role/account/team-state checks, produce consistent 401/403/404 semantics, and provide safe administrative bootstrap tooling.

### 4.4 Rate limiting is single-process only

The limiter is held in process memory. Limits reset on restart and are not shared between workers or replicas.

**Required outcome:** keep the simple limiter for local development if useful, but use Redis or an ingress/API-gateway limit in deployment. Document trust boundaries around forwarded IP headers.

### 4.5 Frontend state and data fetching

The frontend is route-complete but each page largely manages fetching, loading, errors, authentication redirects, and realtime refreshes independently.

Consequences:

- Repeated fetch and redirect patterns
- Inconsistent loading/error/empty states
- Broad refetches after WebSocket events
- Weak cache coordination
- LocalStorage token handling spread through client code
- No shared schema generation or runtime validation of backend payloads

**Required outcome:** introduce a coherent client data layer, shared session boundary, typed contracts, query invalidation rules, and consistent UX states.

### 4.6 React quality failures

The production build passes, but ESLint consistently reports three errors:

- `frontend/app/master/page.tsx`: state-setting flow invoked synchronously from an effect.
- `frontend/components/boot-sequence.tsx`: synchronous state updates inside an effect.
- `frontend/hooks/useTeamSocket.ts`: mutating a ref during render.

Development browser runs also emitted 403 resource and HMR WebSocket console errors during testing.

**Required outcome:** fix React lifecycle patterns and make lint a required CI gate. Reproduce and diagnose dev-server console failures in a clean environment.

### 4.7 User experience and accessibility

The current UI establishes a strong cyber-mission theme but needs a systematic product pass.

Areas to improve:

- Keyboard and screen-reader behavior
- Focus management after dialogs, claims, submissions, and navigation
- Form labels, validation summaries, and error recovery
- Color contrast and reduced-motion behavior
- Mobile layouts during time-sensitive competition actions
- Clear ownership and expiry feedback for claimed questions
- Reliable offline/reconnect messaging
- Consistent loading, empty, locked, success, and error states
- Judge/admin information density and destructive-action confirmation

**Required outcome:** retain the identity, remove theatrical friction, and make every critical action obvious under event pressure.

### 4.8 No automated tests

The repository has no backend tests, frontend tests, or end-to-end tests.

This is the largest delivery risk because the product depends on concurrency, permissions, irreversible judging, deadlines, and chained round unlocks.

**Required outcome:** build a test pyramid around public behavior before large refactors.

### 4.9 No delivery and operations foundation

Currently absent:

- CI workflows
- Deployment manifests
- Container definitions
- Production environment specification
- Structured logging and request correlation
- Metrics, tracing, and alerting
- Backup and restore procedures
- File-storage backup strategy
- Event-day runbook
- Data retention policy
- Disaster recovery drill

**Required outcome:** make deployment reproducible and live-event operations boring.

### 4.10 Configuration validation is too permissive

Runtime settings exist, but production safety checks are minimal. Weak JWT secrets, invalid origins, filesystem paths, missing storage permissions, and environment-specific assumptions can survive until runtime.

**Required outcome:** validate environment mode, secrets, URLs, origins, upload limits, directories, deadlines, and production-only requirements during startup.

---

## 5. Things We Should Not Do

- Do not rewrite the whole platform only because parts are messy.
- Do not begin with visual polish while business invariants remain unsafe.
- Do not introduce microservices. The current scale does not justify them.
- Do not add abstractions without a concrete boundary or testability benefit.
- Do not trust frontend checks for competition rules.
- Do not retain local filesystem storage as the only production strategy.
- Do not ship another major feature before establishing automated acceptance coverage.
- Do not allow development reset endpoints in production.
- Do not hide known gaps behind “smoke-tested” language.

---

## 6. Proposed Target Shape

### 6.1 Backend

Keep a modular FastAPI monolith, but establish clearer layers:

1. **Routers:** HTTP/WebSocket translation only.
2. **Application services:** use cases and transaction boundaries.
3. **Domain rules:** explicit state-transition and scoring policies.
4. **Repositories/storage adapters:** SQLAlchemy and file/object storage details.
5. **Infrastructure:** config, rate limiting, logging, jobs, and observability.

Public operations should return predictable domain errors translated into stable HTTP responses.

### 6.2 Database

- Encode uniqueness and current-row rules in migrations.
- Introduce explicit state-transition constraints where practical.
- Standardize timestamps and timezone handling.
- Add indexes based on real query paths.
- Define reset/archive behavior rather than deleting state casually.
- Add audit fields or an event log for sensitive administrative and judging actions.

### 6.3 Frontend

- Central session/auth provider.
- Query/cache layer for server state.
- Generated or shared API types.
- Domain-oriented modules instead of page-local duplication.
- Central WebSocket connection and targeted cache invalidation.
- Reusable loading, error, empty, locked, and permission states.
- Accessible component primitives and form handling.
- Role-aware route protection that does not depend only on client redirects.

### 6.4 Storage

Define a `SubmissionStorage` boundary with local and object-storage implementations.

Upload flow:

1. Authenticate and authorize.
2. Check round and deadline.
3. Validate extension, MIME, file signature, size, and filename.
4. Stream to temporary storage.
5. Persist submission metadata under DB constraints.
6. Atomically promote the file.
7. Compensate or reconcile if either side fails.
8. Record an audit event.

### 6.5 Operations

- Containerized local and production-like environments
- CI for lint, type-check, tests, migration checks, and production builds
- Structured logs with request/team identifiers where safe
- Health, readiness, and dependency checks
- Metrics for registrations, logins, claims, answers, unlocks, submissions, judging, rate limits, and WebSockets
- Backup/restore scripts and rehearsal
- Event-day dashboard and runbook

---

## 7. Testing Strategy

### 7.1 Backend integration tests

Use a real PostgreSQL test database. Prioritize:

- Three-member registration transactionality
- Duplicate email/team registration
- Login, invalid credentials, disabled users, and token expiry
- Role boundaries for every router
- Round unlock invariants
- Empty previous-round/vacuous-truth edge cases
- Concurrent claim winner
- Expired claim reclaim
- Expired owner answer/release rejection
- Correct and incorrect attempts
- No answer leakage
- Case assignment idempotency
- Submission deadline, validation, ownership, versions, and concurrency
- Judge assignment, score caps, finalization, and edit rejection
- Master-code setup and verification
- Admin reset/archive behavior
- WebSocket authentication, origin checks, scoping, and events

### 7.2 Frontend tests

- Component tests for forms and state components
- Session expiry and role redirects
- Question claim/answer interactions
- Realtime update behavior
- Upload progress and errors
- Judge score validation
- Keyboard navigation and accessibility checks

### 7.3 End-to-end acceptance journeys

1. Fresh team registration through Round 1.
2. Full participant journey through Master Terminal.
3. Concurrent members claiming the same question.
4. Submission replacement and deadline behavior.
5. Judge review and finalization.
6. Administrator event setup, intervention, and recovery.
7. Reconnect after WebSocket/network interruption.
8. Restore from backup into a clean environment.

Seed data should serve these journeys rather than merely populate screenshots.

---

## 8. Proposed Overhaul Phases

### Phase 0: Freeze and baseline

- Record current public API contracts.
- Convert verified acceptance probes into committed tests.
- Add CI with current build, compile, lint, and tests.
- Document known failures explicitly.

**Exit gate:** baseline suite runs reproducibly; failures are intentional and tracked.

### Phase 1: Business-rule integrity

- Fix claim-expiry enforcement.
- Repair seed/gate inconsistency.
- Add DB constraints for cases, submissions, scores, and assignments.
- Formalize round state transitions.
- Test concurrency and transaction rollback.

**Exit gate:** all competition invariants pass against PostgreSQL under concurrent requests.

### Phase 2: Authentication, authorization, and configuration

- Decide session/token architecture.
- Centralize role and account-state enforcement.
- Correct error semantics.
- Add safe admin bootstrap.
- Add startup validation and production-safe defaults.
- Replace distributed in-memory limiting for deployed environments.

**Exit gate:** auth matrix and configuration failure tests pass.

### Phase 3: Submission and data lifecycle

- Introduce storage abstraction.
- Make uploads recoverable and version-safe.
- Add object-storage deployment option.
- Define archive/reset semantics.
- Add audit logging for sensitive actions.

**Exit gate:** simulated filesystem/object-store and DB failures leave recoverable consistent state.

### Phase 4: Frontend architecture

- Fix lint errors.
- Establish session and query layers.
- Consolidate API contracts and errors.
- Centralize WebSocket lifecycle.
- Replace broad refetching with targeted invalidation.

**Exit gate:** frontend tests pass, lint is clean, and critical flows use shared infrastructure.

### Phase 5: Product and accessibility redesign

- Refine information architecture for participant, admin, and judge roles.
- Preserve the DigiHunt visual identity.
- Improve mobile, keyboard, screen-reader, reduced-motion, and error recovery.
- Test under event-like timing and network conditions.

**Exit gate:** critical journeys pass automated accessibility checks and human usability review.

### Phase 6: Deployment and event operations

- Add containers and production deployment manifests.
- Add observability, backups, restores, runbooks, and incident procedures.
- Load-test REST, PostgreSQL, uploads, and WebSockets.
- Rehearse a full event.

**Exit gate:** clean deployment and restore succeed; load targets hold; event rehearsal completes without manual database surgery.

---

## 9. Definition of Done for the Overhaul

The overhaul is not complete because the code looks cleaner. It is complete when:

- Competition rules are encoded and tested.
- Concurrent actions cannot corrupt state.
- Authentication and authorization behavior is consistent.
- Uploads are recoverable and production-safe.
- Participant, administrator, and judge journeys work end to end.
- The frontend is lint-clean, accessible, responsive, and resilient.
- CI blocks regressions.
- Deployment is reproducible.
- Metrics and logs explain failures quickly.
- Backup and restore are proven.
- Event staff can operate the platform using documented tools and runbooks.

---

## 10. Open Decisions

Write decisions underneath each prompt. Delete options freely.

### Product scope

- Is this platform only for one DigiHunt event, or should it support many events?
- Are rounds and question blueprints fixed or configurable?
- Is a team always exactly three members?
- Does judging happen during or after the event?
- Is the Master Terminal competitive, ceremonial, or both?

**Decision notes:**

- 

### Deployment

- Target host/provider?
- Single machine, managed containers, or Kubernetes?
- Managed PostgreSQL?
- S3-compatible submission storage?
- Expected team count and simultaneous connections?

**Decision notes:**

- 

### Authentication

- Keep JWT bearer tokens or move to secure HTTP-only cookie sessions?
- Need password reset, email verification, or invite-based accounts?
- Need administrator MFA?

**Decision notes:**

- 

### Event operations

- Who can pause/unlock/reset rounds?
- Which actions require confirmation or dual approval?
- What data must survive after the event?
- What is the acceptable downtime and recovery time?

**Decision notes:**

- 

---

## 11. Owner Notes: Dump Your Shit Here

This section belongs to the project owner. Grammar, ordering, and feasibility do not matter yet. Add anything: ideas, rage, references, constraints, features, visual direction, things to delete, and things that must never change.

### Things I hate about the current version

- 

### Things I absolutely want

- 

### Things that must stay

- 

### Things we should delete

- 

### Visual direction and references

- 

### Event rules or real-world constraints Jcode does not know yet

- 

### Wild ideas

- 

### Priority overrides

- 

### Questions for Jcode

- 

---

## 12. Parking Lot

Ideas that may be useful later but should not derail foundational work:

- Multi-event tenancy
- Configurable competition builders
- Rich analytics and replay
- Spectator mode
- Public leaderboard
- Notifications beyond WebSockets
- Pluggable question types
- Automated judging assistance
- Mobile application
- Offline/PWA competition mode

Add or remove freely.

---

## 13. Immediate Next Step

1. Owner edits **Section 11** and answers whichever open decisions matter now.
2. We reconcile owner intent with the technical findings.
3. We mark each proposal as **keep**, **change**, **delete**, or **later**.
4. Only then do we turn this document into an implementation plan.
