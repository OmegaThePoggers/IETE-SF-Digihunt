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

### Windows setup

Use Docker Desktop with the WSL 2 backend. This avoids path, volume, and file-watching issues that happen with the legacy Hyper-V backend.

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. During setup, enable **Use WSL 2 instead of Hyper-V**.
3. Open Docker Desktop, go to **Settings → Resources → WSL Integration**, and enable your Ubuntu or preferred WSL distro.
4. Open the project from a WSL terminal, not PowerShell, for the smoothest workflow:

```bash
cd ~/projects/IETE-SF-Digihunt
```

If the repo is on `C:\`, move or clone it inside WSL, for example under `~/projects`, before running Compose. Keeping the repo on the Windows filesystem can make installs and Docker volume mounts much slower.

### Start the stack

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

On Windows, open the site in your normal browser at `http://localhost:3000`. If Docker Desktop asks for firewall access, allow it on private networks.

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

For the hardened Windows 11 laptop deployment with Nginx and Cloudflare Tunnel, use [`docs/DEPLOY_WINDOWS_11_CLOUDFLARE.md`](docs/DEPLOY_WINDOWS_11_CLOUDFLARE.md). Keep [`docs/OPERATIONS.md`](docs/OPERATIONS.md) open during the event.

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

## Competition workflow

1. Teams of 1–4 participants solve Round 1 and recover team-specific cipher fragments.
2. Teams unscramble the fragments in the Round 2 cipher gate, then complete Round 2 MCQs.
3. The same fragment-and-cipher-gate flow unlocks Round 3 and then Round 4.
4. A team uploads one final `.ppt` or `.pptx` presentation in Round 4. The submission is visible to the team and judges but cannot be replaced.
5. Judges review and score the Round 4 final presentation.

The dashboard provides `Review round` controls for completed stages and cipher gates between rounds. Judges see per-team Round 1–4 status ticks, a read-only Round 2 MCQ summary, final presentation downloads, and Round 4 scoring controls.

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

- Participants: `<prefix><a|b|c>@digihunt.demo` / `Demo1234!` (e.g. `demo1a@digihunt.demo`). Teams may register with 1–4 participants.
- Judges: `judge1@digihunt.demo` / `judge2@digihunt.demo` — `Judge1234!`

There is no seeded admin account — create one directly in the `users` table
(role=`admin`) or promote an existing user.

### Route map

**Participant** (JWT required unless noted)
| Route | Method | Notes |
|---|---|---|
| `/auth/register-team` | POST | public — creates a team with 1–4 users |
| `/auth/login` | POST | public — rate-limited 10/min |
| `/auth/me` | GET | |
| `/teams/me` | GET | team + round progress |
| `/questions/round/{1,2,3}` | GET | MCQ board, gated by the preceding cipher where applicable |
| `/questions/{id}/claim` \| `/release` \| `/answer` | POST | atomic claim, round-agnostic |
| `/incident` | GET | shared Round 2 case narrative |
| `/cases/me` | GET | 403 until Round 4 is unlocked |
| `/submissions` | POST | one final `.ppt` or `.pptx` upload, then locked |
| `/submissions/current` \| `/history` | GET | current final submission |
| `/submissions/{id}/download` | GET | own team only |
| `/gates/{2,3,4}` \| `/gates/{2,3,4}/unlock` | GET / POST | team-specific cipher-gate status and verification |

**Admin** (role=admin, prefix `/admin`): `/dashboard`, `/teams`, `/teams/{id}`,
`/submissions`, `/submissions/{id}/download`, `/settings` (GET/PUT), plus `/dev/*` operational
tools (reset-team, reset-question, unlock-round, assign-case).

**Judge** (role=judge, prefix `/judging`): `/assigned`, `/teams/{id}`,
`/teams/{id}/download`, `/teams/{id}/score` (POST, one-way finalize).

**Realtime**: `GET /ws?token=<jwt>` — team-scoped WebSocket. Origin checked
against `CORS_ORIGINS` at handshake. Events: `question_claimed/released/solved`,
`round_progress_updated`, `round_unlocked`, `submission_uploaded`,
`member_online/offline`.

**Frontend pages**: `/`, `/register`, `/login`, `/dashboard`, `/round1`,
`/round2`, `/round3`, `/gate/[round]`, `/round4`, `/admin/*`, `/judge/*`.

### Hardening (G11)

- In-memory rate limiting (60/min general, 10/min on `/auth/login` and
  cipher-gate verification) — single-process only, see `app/core/rate_limit.py`.
- WebSocket handshake checks `Origin` against `CORS_ORIGINS`.
- Global exception handler returns `{"detail": "Internal server error"}` on
  any unhandled 500, logging the real exception server-side only.
