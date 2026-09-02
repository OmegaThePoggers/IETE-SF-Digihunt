# DigiHunt handoff context

This file is the continuity brief for a new agent window working on this repository.

## Repository

- Local workspace: `/home/omegafied/projects/IETE-SF-Digihunt`
- Local branch: `static-page-full`
- Shared deployment branch: `main`
- Publish command: `git push origin HEAD:main`
- Primary remote: `https://github.com/OmegaThePoggers/IETE-SF-Digihunt.git`

Do not assume the local branch name is `main`. Always fetch `origin/main` before publishing and confirm `HEAD` equals `origin/main` afterward.

## Current product flow

DigiHunt is a Next.js frontend, FastAPI backend, PostgreSQL event platform for IETE SF.

1. Registration creates a team with **1 to 4 participants**. Each participant has their own email, while the team shares one password.
2. Rounds 1, 2, and 3 are auto-checked MCQ boards.
3. Each correctly solved MCQ reveals a team-specific code fragment.
4. The team solves the fragment anagram in a cipher gate to unlock the next round.
5. Round 4 is the final presentation stage. Teams upload one `.ppt` or `.pptx` and cannot replace it.
6. Judges review and score only Round 4. There is no Round 2 approval gate.

Relevant frontend routes:

- `/register`, `/login`, `/dashboard`
- `/round1`, `/round2`, `/round3`
- `/gate/[round]`
- `/round4`
- `/admin/*`, `/judge/*`

## Implemented and published work

These commits are already on `origin/main`:

- `f94aa9f fix: auto-check Round 2 MCQs`
- `de77143` IETE SF logo and theme work
- `6adbad5 feat: implement four-round cipher gate flow`
- `5622435 feat: support teams of one to four participants`
- `ec9dcc1 feat: refine registration roster layout`

Verification completed before this handoff:

- Backend tests passed.
- Frontend suite passed with 58 tests.
- Frontend lint and production build passed.
- Docker stack rebuilt and healthy at `http://localhost:3000` and `http://localhost:8000/health`.
- One-member and four-member registrations were smoke-tested against the live local API.

## Current task, not yet implemented

The user rejected the latest roster visual treatment. The current registration panel looks too artificial because every row includes both a number chip and a stacked, repeated `Participant 01` label.

The user approved this replacement:

```text
01 | Full name input | Email address input
02 | Full name input | Email address input
...
```

Requirements:

- Keep the existing 1–4 participant picker and dynamic roster behavior.
- Keep all validation, payloads, input IDs, autocomplete, and accessible labels intact.
- Remove the repeated `Participant 01` text label.
- Use one compact horizontal row per participant on desktop.
- Make it responsive on mobile. Number is retained and inputs stack naturally under or beside it without overflowing.
- Keep the dark IETE event style but reduce decoration and visual fragmentation.

An approved design specification was written and committed locally:

- `docs/superpowers/specs/2026-09-02-registration-roster-table-design.md`
- Local commit: `17fd66c docs: specify compact registration roster`

This commit has not yet been pushed to `origin/main` at the moment this file was written. The user already said yes to the compact row design.

Main file to edit:

- `frontend/components/auth/register-form.tsx`

Relevant test:

- `frontend/test/access-pages.test.tsx`

Suggested implementation shape:

```tsx
<div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] ...">
  <span>01</span>
  <div>Full name label + input</div>
  <div>Email address label + input</div>
</div>
```

On mobile, use a grid where the number occupies its own first column and the two fields stack in the remaining area. Do not bring back the multiline `Participant 01` label.

## Safe implementation sequence

1. Read `docs/superpowers/specs/2026-09-02-registration-roster-table-design.md`.
2. Inspect `frontend/components/auth/register-form.tsx` and `frontend/test/access-pages.test.tsx`.
3. Update the roster layout and adapt/add a test that asserts one participant row with the ordinal and both fields.
4. Run:

   ```bash
   cd frontend
   npm test -- --run
   npm run lint
   npm run build
   ```

5. Deploy and smoke-test:

   ```bash
   cd ..
   docker compose up --build -d
   docker compose ps
   curl -fsS http://localhost:3000/register | grep -q 'Participant details'
   curl -fsS http://localhost:8000/health
   ```

6. Commit only intended tracked changes. Do not stage the untracked files listed below.
7. Publish and verify:

   ```bash
   git push origin HEAD:main
   git fetch origin main
   test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
   git status --short
   ```

## Setup instructions for a new window

### Use the existing local clone

```bash
cd /home/omegafied/projects/IETE-SF-Digihunt
git status --short
git fetch origin main
git log --oneline -5
```

Use `docker compose` from the repository root. The Compose file is `compose.yaml`.

```bash
# Create local settings only when .env does not already exist
[ -f .env ] || cp .env.docker.example .env

# Start or rebuild the full local stack
docker compose up --build -d
docker compose ps

# Open app: http://localhost:3000
# Backend health: http://localhost:8000/health
# Backend docs: http://localhost:8000/docs
```

Never run `docker compose down --volumes` unless the user explicitly wants to erase all local database and upload data.

### Frontend-only workflow

```bash
cd frontend
npm install
npm run dev
```

Common checks:

```bash
npm test -- --run
npm run lint
npm run build
```

### Backend-only workflow

Install `uv`, then:

```bash
cd backend
cp .env.example .env
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend checks:

```bash
cd backend
uv run pytest
```

### Data and migrations

- Migration history: `backend/alembic/versions/`
- Current four-round/anagram migration: `c3f1a20b7de4_four_rounds_anagram_gates.py`
- Seed command: `docker compose exec backend python -m app.seed`
- Seed is idempotent.

## Do not touch without user instruction

The following root files are pre-existing and untracked. Leave them unmodified and unstaged:

- `PLANV2.md`
- `ietelogo.png`
- `digi hunt final 20qs (1).pdf`

Also avoid destructive Git operations, database resets, password resets, and any changes to the event flow unless explicitly requested.

## UI note

The user values an intentional, human-looking interface and explicitly called the current roster appearance “ugly and ai.” Avoid decorative labels that duplicate information. Favor clear visual hierarchy, fewer borders, logical alignment, and form layouts that look like a real registration form.
