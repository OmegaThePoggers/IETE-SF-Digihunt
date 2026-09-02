# DigiHunt — The Missing Code

Story-driven technical competition platform. Frontend (Next.js) displays the mission; backend (FastAPI) enforces the rules; PostgreSQL remembers the state. See `PLAN.md` for build phases.

## Structure

```
digihunt/
├── frontend/   Next.js + TS + Tailwind + shadcn
├── backend/    FastAPI + SQLAlchemy 2.0 + Alembic
├── uploads/    PPTX submissions (local filesystem, gitignored)
└── PLAN.md     phased build plan
```

## Run with Docker

Docker is the recommended way to run the complete local stack. It starts PostgreSQL, applies Alembic migrations, and serves the FastAPI backend and Next.js frontend.

```bash
# Optional: override the local-development defaults
cp .env.docker.example .env

# Build and start all services
docker compose up --build -d

# Check health and open the application
docker compose ps
# Frontend: http://localhost:3000
# Backend API docs: http://localhost:8000/docs
```

The database and uploaded presentation files are retained in named Docker volumes. PostgreSQL is private to the Compose network and is not exposed on the host.

Common operations:

```bash
# Follow all service logs
docker compose logs -f

# Follow one service
docker compose logs -f backend

# Apply migrations manually
docker compose exec backend alembic upgrade head

# Seed demo teams and judges
docker compose exec backend python -m app.seed

# Stop containers while preserving data
docker compose down

# Rebuild after dependency or Dockerfile changes
docker compose up --build -d
```

To permanently delete the local Docker database and uploaded files, run the following destructive reset command:

```bash
docker compose down --volumes
```

Before any shared or production deployment, copy `.env.docker.example` to `.env` and replace `POSTGRES_PASSWORD` and `JWT_SECRET`. `NEXT_PUBLIC_API_URL` must be the backend URL reachable by participants' browsers, not the backend Compose service name.

## Run — Frontend

```bash
cd frontend
npm install
npm run dev
```

## Run — Backend

Install [`uv`](https://docs.astral.sh/uv/getting-started/installation/) first, then:

```bash
cd backend
cp .env.example .env
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Fill in `DATABASE_URL` and `JWT_SECRET` in `.env` before running the migration or server.

### Backend dependencies

Run dependency management commands from `backend/`:

```bash
uv add <package>             # add a runtime dependency and update uv.lock
uv remove <package>          # remove a dependency and update uv.lock
uv lock --upgrade            # upgrade all dependencies within project constraints
uv sync --locked             # reproduce the committed environment exactly
```

Commit both `pyproject.toml` and `uv.lock` whenever dependencies change.

### Backend hosting

Use these commands from `backend/` in a hosting provider's release workflow:

```bash
# Build
uv sync --locked --no-dev

# Release phase, once per deployment
uv run --no-sync alembic upgrade head

# Start
uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Run migrations once in the release phase, not in every application process. `uv` makes dependency resolution and environment builds faster and reproducible; it does not make the running FastAPI application itself faster.

## Status

Build complete (G1–G11). Full spec journey — register, Round 1–3, admin,
judging, Master Terminal, realtime sync — implemented and smoke-tested
end-to-end.

### Seed demo data

```bash
cd backend
uv run python -m app.seed
```

Idempotent — safe to re-run. Creates 3 demo teams (one full playthrough, one
mid-Round-2, one fresh) and 2 judges, and prints credentials on completion:

- Participants: `<prefix><a|b|c>@digihunt.demo` / `Demo1234!` (e.g. `demo1a@digihunt.demo`)
- Judges: `judge1@digihunt.demo` / `judge2@digihunt.demo` — `Judge1234!`

There is no seeded admin account — create one directly in the `users` table
(role=`admin`) or promote an existing user.

### Route map

**Participant** (JWT required unless noted)
| Route | Method | Notes |
|---|---|---|
| `/auth/register-team` | POST | public — creates team + 3 users |
| `/auth/login` | POST | public — rate-limited 10/min |
| `/auth/me` | GET | |
| `/teams/me` | GET | team + round progress |
| `/questions/round/1` | GET | board + access key once all solved |
| `/questions/round/2` | GET | 403 until Round 1 complete |
| `/questions/{id}/claim` \| `/release` \| `/answer` | POST | atomic claim, round-agnostic |
| `/incident` | GET | shared Round 2 case narrative |
| `/cases/me` | GET | 403 until Round 2 complete |
| `/submissions` | POST | PPTX upload, versioned |
| `/submissions/current` \| `/history` | GET | |
| `/submissions/{id}/download` | GET | own team only |
| `/master/status` \| `/master/verify` | GET / POST | verify rate-limited 10/min |

**Admin** (role=admin, prefix `/admin`): `/dashboard`, `/teams`, `/teams/{id}`,
`/submissions`, `/submissions/{id}/download`, `/settings` (GET/PUT),
`/master-code` (POST), `/master-code/status` (GET), plus `/dev/*` operational
tools (reset-team, reset-question, unlock-round, assign-case).

**Judge** (role=judge, prefix `/judging`): `/assigned`, `/teams/{id}`,
`/teams/{id}/download`, `/teams/{id}/score` (POST, one-way finalize).

**Realtime**: `GET /ws?token=<jwt>` — team-scoped WebSocket. Origin checked
against `CORS_ORIGINS` at handshake. Events: `question_claimed/released/solved`,
`round_progress_updated`, `round_unlocked`, `submission_uploaded/replaced`,
`master_terminal_unlocked`, `member_online/offline`.

**Frontend pages**: `/`, `/register`, `/login`, `/dashboard`, `/round1`,
`/round2`, `/round3`, `/master`, `/admin/*`, `/judge/*`.

### Hardening (G11)

- In-memory rate limiting (60/min general, 10/min on `/auth/login` and
  `/master/verify`) — single-process only, see `app/core/rate_limit.py`.
- WebSocket handshake checks `Origin` against `CORS_ORIGINS`.
- Global exception handler returns `{"detail": "Internal server error"}` on
  any unhandled 500, logging the real exception server-side only.
