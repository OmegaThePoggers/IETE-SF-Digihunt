# Docker Stack Design

## Goal

Run DigiHunt locally with one `docker compose up --build` command, including PostgreSQL, FastAPI migrations/API, Next.js, and persistent PowerPoint storage.

## Architecture

- `db`: PostgreSQL 17 Alpine with a named data volume and `pg_isready` health check.
- `backend`: Python 3.12 slim image built with locked `uv` dependencies, running as a non-root user. It waits for healthy PostgreSQL, applies Alembic migrations, then starts Uvicorn. Uploaded PPT files live in a named volume mounted at `/data/ppts`.
- `frontend`: Node 22 slim multi-stage build using Next.js standalone output, running as the built-in non-root `node` user. The public browser API URL is baked from `NEXT_PUBLIC_API_URL` at build time.
- Only ports 3000 and 8000 are published. PostgreSQL remains reachable only on the private Compose network.

## Configuration

A root `.env.docker.example` documents local defaults. Compose reads optional overrides from `.env`; no secrets are copied into either image. Local defaults are explicitly development-only.

## Reliability and Security

- Application containers run as non-root users.
- Dependency files are copied before application sources for build caching.
- Health checks gate startup ordering.
- PostgreSQL and PPT files use named volumes.
- Containers restart unless manually stopped.
- Build contexts exclude source-control metadata, local environments, caches, test output, and runtime uploads.

## Acceptance

- `docker compose config` succeeds.
- Both images build from clean contexts.
- PostgreSQL becomes healthy and migrations complete.
- `GET http://localhost:8000/health` returns `{"status":"ok"}`.
- `GET http://localhost:3000` returns an HTML response.
- Backend can resolve and connect to the `db` service.
- The PPT volume is writable by the non-root backend process.
