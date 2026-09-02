# Round 2 Review and Judge Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Round 2 automatically validated while turning the existing judge area into a complete queue for reviewing investigation answers, PowerPoint submissions, and traceable final scores.

**Architecture:** FastAPI derives judging readiness from existing Round 2 progress, submissions, and the requesting judge's score. Structured judge-only review contracts expose `Attempt` history without changing participant responses. Scores reference the reviewed submission, and admin-only reopen actions are recorded in a small audit table. Next.js pages consume these contracts through focused, testable queue and review components.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, Pydantic v2, Next.js 16, React 19, TypeScript, Tailwind, Vitest, Testing Library, Playwright.

---

## Scope

**In:** automatic Round 2 validation, judge queue statuses and filters, structured Round 2 review, latest PPT metadata/download, draft and finalized scoring, score-to-submission linkage, admin reopen with audit record, backend/frontend tests.

**Out:** manual approval of objective answers, free-form Round 2 questions, judge assignment, shared score editing, browser-rendered PowerPoint previews, rubric changes.

## Assumptions

- Round 2 remains objective and automatically checked. No judge approval blocks Round 3.
- Every judge can review every eligible team because no assignment model currently exists.
- The team's current submission is the artifact offered for new judging work.
- Finalization records the exact submission version reviewed.
- All backend integration tests run only against a disposable database whose name ends in `_test`.

## File Map

### Backend

- Create `backend/app/models/judging_audit.py`: immutable audit records for score finalization and reopening.
- Modify `backend/app/models/score.py`: link finalized scores to the reviewed submission.
- Modify `backend/app/models/__init__.py`: export the audit model.
- Create `backend/alembic/versions/c4e8a12f7b90_judge_review_workflow.py`: add `scores.submission_id` and `judging_audits`.
- Modify `backend/app/schemas/judging.py`: queue status, progress, submission, attempt, and detail contracts.
- Modify `backend/app/schemas/admin.py`: reopen request and response contracts.
- Create `backend/app/services/judging.py`: derive queue status and build Round 2 review data.
- Modify `backend/app/routers/judging.py`: list all eligible teams, return structured review data, and finalize against a submission.
- Modify `backend/app/routers/admin.py`: reopen finalized scores and write audit records.
- Modify `backend/pyproject.toml` and `backend/uv.lock`: add test-only dependencies.
- Create `backend/tests/conftest.py`: app, database, authentication, team, question, submission, and score fixtures.
- Create `backend/tests/test_judging.py`: judging workflow and authorization tests.
- Create `backend/tests/test_admin_judging.py`: reopen and audit tests.

### Frontend

- Modify `frontend/lib/api.ts`: align judging and admin contracts with backend responses.
- Create `frontend/features/judging/judging-types.ts`: UI models and status constants.
- Create `frontend/features/judging/judge-queue-view.tsx`: searchable/filterable queue presentation.
- Create `frontend/features/judging/team-review-view.tsx`: investigation, presentation, and scoring presentation.
- Modify `frontend/app/judge/page.tsx`: fetch and control the queue.
- Modify `frontend/app/judge/teams/[id]/page.tsx`: orchestrate review, drafts, downloads, and finalization confirmation.
- Modify `frontend/app/admin/teams/[id]/page.tsx`: show score submission linkage and reopen controls.
- Create `frontend/test/judge-queue-view.test.tsx`: queue behavior.
- Create `frontend/test/team-review-view.test.tsx`: detail and scoring behavior.
- Create `frontend/e2e/judging-workflow.spec.ts`: acceptance workflow.

---

### Task 1: Establish the Backend Test Harness

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/uv.lock`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Add backend development dependencies**

Add a development dependency group containing `pytest`, `pytest-asyncio`, and `httpx2`, then run:

```bash
cd backend
uv add --dev pytest pytest-asyncio httpx2
```

Expected: `pyproject.toml` and `uv.lock` contain the test dependencies without changing runtime dependencies.

- [ ] **Step 2: Create isolated database and API fixtures**

In `backend/tests/conftest.py`, provide fixtures named `db_session`, `client`, `judge_headers`, and `admin_headers`. `db_session` reads `TEST_DATABASE_URL`, opens one outer transaction, and rolls it back after each test. `client` overrides `get_db` with that session and yields a FastAPI `TestClient`. The header fixtures create real users with the appropriate `UserRole`, issue JWTs through `app.core.security`, and return `{"Authorization": f"Bearer {token}"}`.

Use a dedicated PostgreSQL database and refuse to start if the parsed database name does not end in `_test`. For local development, configure it explicitly before any test command:

```bash
export TEST_DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:5432/digihunt_test'
```

Create tables from `Base.metadata` before the test session. Generate JWT headers through the application's existing security functions rather than bypassing role dependencies.

- [ ] **Step 3: Prove role enforcement through the harness**

Add a smoke test asserting an unauthenticated request to `GET /judging/assigned` returns `401` and a participant token returns `403`.

- [ ] **Step 4: Run the harness test**

```bash
cd backend
uv run pytest tests/test_judging.py -q
```

Expected: the authorization smoke tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/tests
git commit -m "test(backend): add API integration harness"
```

### Task 2: Persist Reviewed Submissions and Judging Audit Records

**Files:**
- Modify: `backend/app/models/score.py`
- Create: `backend/app/models/judging_audit.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/c4e8a12f7b90_judge_review_workflow.py`
- Test: `backend/tests/test_judging.py`

- [ ] **Step 1: Write failing persistence tests**

Create tests asserting:

```python
assert finalized_score.submission_id == current_submission.id
assert audit.action == "score_finalized"
assert audit.actor_id == judge_user.id
assert audit.team_id == team.id
```

Also assert a draft score has `submission_id is None` and no finalization audit.

- [ ] **Step 2: Add model fields**

Add to `Score`:

```python
submission_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("submissions.id"), nullable=True
)
```

Create `JudgingAudit` with UUID primary key, `actor_id`, `team_id`, nullable `score_id`, nullable `submission_id`, `action`, JSON `details`, and server-generated timezone-aware `created_at`.

- [ ] **Step 3: Generate and review the migration**

Generate the migration, rename the generated file to `c4e8a12f7b90_judge_review_workflow.py`, and set its `revision` value to `c4e8a12f7b90` before review:

```bash
cd backend
uv run alembic revision --autogenerate -m "add judge review workflow"
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic downgrade -1
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
```

Expected: upgrade adds the nullable score foreign key, audit table, indexes on audit `team_id` and `created_at`, and no unrelated schema changes. Downgrade removes only these additions.

- [ ] **Step 4: Run persistence tests**

```bash
cd backend
uv run pytest tests/test_judging.py -q
```

Expected: persistence tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models backend/alembic/versions backend/tests/test_judging.py
git commit -m "feat(judging): track reviewed submissions and audits"
```

### Task 3: Define Judging Queue and Review Contracts

**Files:**
- Modify: `backend/app/schemas/judging.py`
- Create: `backend/app/services/judging.py`
- Test: `backend/tests/test_judging.py`

- [ ] **Step 1: Write status derivation tests**

Cover these exact cases:

```text
round2 incomplete -> round2_incomplete
round2 complete + no current submission -> awaiting_submission
current submission + no score -> ready_to_judge
non-finalized score -> draft_score
finalized score -> finalized
```

Assert ready and draft teams sort before incomplete and finalized teams.

- [ ] **Step 2: Add explicit response models**

Define:

```python
JudgingStatus = Literal[
    "round2_incomplete", "awaiting_submission", "ready_to_judge",
    "draft_score", "finalized"
]

class Round2ProgressOut(BaseModel):
    solved: int
    total: int

class Round2AttemptOut(BaseModel):
    selected_answer: str
    correct: bool
    submitted_at: datetime
    submitted_by: uuid.UUID

class Round2QuestionReviewOut(BaseModel):
    team_question_id: uuid.UUID
    category: str
    question_text: str
    options: list[str]
    status: str
    solved_at: datetime | None
    solved_by: uuid.UUID | None
    attempts: list[Round2AttemptOut]
```

Expand `AssignedSubmissionOut` with `version` and `file_size`. Make queue/detail `submission` nullable. Add `status`, `round2_progress`, and `round2_questions` fields as specified by the design.

- [ ] **Step 3: Implement pure service helpers**

In `backend/app/services/judging.py`, implement `derive_judging_status(progress, submission, score)` and `build_round2_review(db, team_id)`. Fetch attempts in one batched query and group them by `team_question_id`. Do not expose `Question.correct_answer` as a separate field.

- [ ] **Step 4: Run focused tests**

```bash
cd backend
uv run pytest tests/test_judging.py -k "status or review" -q
```

Expected: all status and review contract tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/judging.py backend/app/services/judging.py backend/tests/test_judging.py
git commit -m "feat(judging): define queue and investigation contracts"
```

### Task 4: Expand Judge APIs and Harden Finalization

**Files:**
- Modify: `backend/app/routers/judging.py`
- Test: `backend/tests/test_judging.py`

- [ ] **Step 1: Write failing endpoint tests**

Test that `GET /judging/assigned` includes eligible teams without submissions, returns each derived status, and includes optional submission metadata. Test that `GET /judging/teams/{id}` returns attempt history only to judges.

Test score behavior:

```text
save draft with submission -> 200
save or finalize without submission -> 409
finalize -> stores current submission id and audit
edit finalized score -> 409
judge B cannot overwrite judge A's score
```

- [ ] **Step 2: Replace submission-driven queue selection**

Start from teams with Round 2 `TeamQuestion` rows instead of joining only current submissions. Batch-load progress, current submissions, cases, and the requesting judge's scores. Build and sort `AssignedTeamOut` without per-team queries.

- [ ] **Step 3: Return structured team details**

Allow the detail endpoint to return teams without submissions. Include `round2_questions`, progress, derived status, optional submission, and the requesting judge's score. Preserve `404` only for a missing team.

- [ ] **Step 4: Bind finalization to the current submission**

Before accepting any score, require a current submission. On `finalize=True`, set `score.submission_id`, `finalized`, and `finalized_at`, then add a `JudgingAudit(action="score_finalized")` in the same transaction. Keep total server-computed.

- [ ] **Step 5: Run endpoint tests**

```bash
cd backend
uv run pytest tests/test_judging.py -q
```

Expected: all judging tests pass with no query-per-team regressions in the queue fixture.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/judging.py backend/tests/test_judging.py
git commit -m "feat(judging): expose complete review workflow"
```

### Task 5: Add Admin Score Reopening

**Files:**
- Modify: `backend/app/schemas/admin.py`
- Modify: `backend/app/routers/admin.py`
- Create: `backend/tests/test_admin_judging.py`

- [ ] **Step 1: Write failing reopen tests**

Assert participant and judge tokens receive `403`, missing or blank reasons receive `422`, non-finalized scores receive `409`, and a valid admin request clears finalization fields while preserving `submission_id` and creating `score_reopened` audit metadata containing the reason.

- [ ] **Step 2: Add request contract**

```python
class ReopenScoreIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
```

- [ ] **Step 3: Add admin endpoint**

Implement `POST /admin/scores/{score_id}/reopen`. Require an existing finalized score, set `finalized=False` and `finalized_at=None`, preserve the reviewed submission reference for traceability, and add an audit row with actor, team, score, submission, and stripped reason in one transaction.

- [ ] **Step 4: Include score IDs in admin team detail**

Extend each item in the existing `scores` response with `id`, `submission_id`, and judge identity suitable for selecting the correct score to reopen.

- [ ] **Step 5: Run admin tests**

```bash
cd backend
uv run pytest tests/test_admin_judging.py -q
```

Expected: all reopen, audit, and role tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/admin.py backend/app/routers/admin.py backend/tests/test_admin_judging.py
git commit -m "feat(admin): reopen finalized judge scores"
```

### Task 6: Build the Judge Queue UI

**Files:**
- Modify: `frontend/lib/api.ts`
- Create: `frontend/features/judging/judging-types.ts`
- Create: `frontend/features/judging/judge-queue-view.tsx`
- Modify: `frontend/app/judge/page.tsx`
- Create: `frontend/test/judge-queue-view.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render fixtures for all five statuses. Assert summary counts, team-code search, status filtering, ready-first ordering, missing-submission text, score totals, keyboard-operable team links, loading, empty, and retry states.

- [ ] **Step 2: Update API contracts**

Make `AssignedTeamOut.submission` nullable and add:

```typescript
type JudgingStatus =
  | "round2_incomplete"
  | "awaiting_submission"
  | "ready_to_judge"
  | "draft_score"
  | "finalized";

interface Round2ProgressOut { solved: number; total: number }
```

Include submission `version` and `file_size`.

- [ ] **Step 3: Implement the pure queue view**

`JudgeQueueView` receives teams, query, selected status, callbacks, loading/error state, and retry callback. Use semantic links or buttons, labeled search/filter controls, visible focus states, and status text in addition to color.

- [ ] **Step 4: Connect the route controller**

Keep API fetching and router behavior in `frontend/app/judge/page.tsx`. Maintain query/filter state locally and pass derived visible teams to `JudgeQueueView`.

- [ ] **Step 5: Run tests and lint**

```bash
cd frontend
npm test -- judge-queue-view.test.tsx --run
npm run lint
```

Expected: queue tests pass and ESLint reports no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/api.ts frontend/features/judging frontend/app/judge/page.tsx frontend/test/judge-queue-view.test.tsx
git commit -m "feat(frontend): add judge work queue"
```

### Task 7: Build the Consolidated Team Review and Scoring UI

**Files:**
- Create: `frontend/features/judging/team-review-view.tsx`
- Modify: `frontend/app/judge/teams/[id]/page.tsx`
- Create: `frontend/test/team-review-view.test.tsx`

- [ ] **Step 1: Write failing review tests**

Assert the view displays question prompts, options, attempt results and timestamps, current PPT version/size/time, missing-submission state, rubric limits, computed total, comments, draft save, and finalized read-only state.

Assert finalization opens a confirmation dialog containing team code, total, and submission version. Assert the confirm action is unavailable without a submission.

- [ ] **Step 2: Implement the pure review view**

Split the view internally into focused `InvestigationSection`, `PresentationSection`, and `ScoreSection` functions in the same file unless any exceeds roughly 150 lines. Do not perform network requests inside the view.

- [ ] **Step 3: Update the route controller**

Fetch the new detail contract, manage score form state, download the current presentation, preserve form values after recoverable failures, save drafts, and finalize only after confirmation. Refresh team details after successful writes.

- [ ] **Step 4: Handle presentation replacement visibly**

Display the current version from each refreshed response. If a draft was loaded against an older displayed version, show a warning before finalization and require the judge to confirm the current version.

- [ ] **Step 5: Run tests, lint, and build**

```bash
cd frontend
npm test -- team-review-view.test.tsx --run
npm run lint
npm run build
```

Expected: tests pass, lint is clean, and the production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/features/judging/team-review-view.tsx frontend/app/judge/teams/'[id]'/page.tsx frontend/test/team-review-view.test.tsx
git commit -m "feat(frontend): add consolidated judge review workspace"
```

### Task 8: Add Admin Reopen Controls

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/admin/teams/[id]/page.tsx`
- Create: `frontend/test/admin-score-reopen.test.tsx`

- [ ] **Step 1: Write failing admin tests**

Assert finalized score rows show reviewed submission metadata and a `REOPEN SCORE` action. Assert the confirmation requires a reason of at least three characters, successful reopening refreshes detail, and API failures preserve the entered reason.

- [ ] **Step 2: Add the admin API function**

```typescript
export function reopenScore(scoreId: string, reason: string) {
  return request<AdminScoreOut>(`/admin/scores/${scoreId}/reopen`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
```

- [ ] **Step 3: Add explicit reopen confirmation UI**

Show judge, team, total, and finalized timestamp. Require a reason, disable duplicate submissions while saving, and explain that reopening permits the same judge to edit and refinalize.

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend
npm test -- admin-score-reopen.test.tsx --run
npm run lint
```

Expected: admin tests pass and lint remains clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/app/admin/teams/'[id]'/page.tsx frontend/test/admin-score-reopen.test.tsx
git commit -m "feat(frontend): add admin score reopening"
```

### Task 9: Validate the End-to-End Event Workflow

**Files:**
- Create: `frontend/e2e/judging-workflow.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add acceptance coverage**

Create seeded test data for one incomplete team, one awaiting-submission team, and one ready team. Automate: participant completes Round 2, uploads a PPTX fixture, judge sees the team become ready, reviews attempts, downloads metadata, saves a draft, finalizes, admin reopens with a reason, and judge edits and refinalizes.

- [ ] **Step 2: Verify authorization boundaries**

In backend integration tests, re-run participant answer-response assertions to ensure `correct_answer` is never serialized. Verify participant, judge, and admin download routes reject unauthorized file access.

- [ ] **Step 3: Run the complete backend suite**

```bash
cd backend
uv run pytest -q
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic check
```

Expected: all tests pass and Alembic reports no pending model changes.

- [ ] **Step 4: Run the complete frontend suite**

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
npm run test:e2e -- judging-workflow.spec.ts
```

Expected: unit tests, lint, build, and judging acceptance workflow pass.

- [ ] **Step 5: Update operational documentation**

Document the automatic Round 2 decision, judge statuses, current-submission rule, finalization lock, admin reopen procedure, audit behavior, and required `TEST_DATABASE_URL` in `README.md`.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/judging-workflow.spec.ts README.md backend/tests frontend/test
git commit -m "test: verify round 2 judging workflow end to end"
```

## Final Acceptance Checklist

- [ ] Objective Round 2 answers still progress automatically without judge intervention.
- [ ] Participant responses never reveal hidden correct answers.
- [ ] Judge queue shows incomplete, awaiting submission, ready, draft, and finalized teams.
- [ ] Judge detail exposes structured Round 2 attempts and current PPT metadata.
- [ ] Judges cannot score without a current submission or edit finalized scores.
- [ ] Finalized scores retain the exact reviewed submission ID.
- [ ] Admin reopening requires a reason and creates an immutable audit record.
- [ ] Role and file-download boundaries are covered by integration tests.
- [ ] Backend tests and migration checks pass.
- [ ] Frontend unit tests, lint, production build, and Playwright workflow pass.
