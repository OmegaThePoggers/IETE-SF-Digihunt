# Docker Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the complete DigiHunt application with one Docker Compose command.

**Architecture:** Compose orchestrates private PostgreSQL, a migration-aware FastAPI container, and a standalone Next.js container. Named volumes persist database and PowerPoint data, while health checks control startup order.

**Tech Stack:** Docker Engine 29, Docker Compose 5, PostgreSQL 17 Alpine, Python 3.12, uv 0.9.7, Node.js 22, Next.js 16.

---

### Task 1: Add image definitions

**Files:** `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/next.config.ts`

- [ ] Enable Next.js `output: "standalone"`.
- [ ] Build the backend from its lock file and run it as UID 10001.
- [ ] Build the frontend in dependency, build, and runtime stages and run it as `node`.
- [ ] Exclude local dependencies, caches, environment files, runtime data, and Git metadata from contexts.
- [ ] Build both images successfully.

### Task 2: Add Compose orchestration

**Files:** `compose.yaml`, `.env.docker.example`

- [ ] Add PostgreSQL with a health check and persistent volume.
- [ ] Add backend migration/start command, API health check, private database URL, CORS configuration, and PPT volume.
- [ ] Add frontend build argument, API URL, health check, and backend dependency.
- [ ] Validate the rendered Compose configuration.

### Task 3: Validate and document

**Files:** `README.md`

- [ ] Start the stack with a clean build.
- [ ] Verify container health, database connectivity, backend health JSON, frontend HTML, and writable PPT storage.
- [ ] Verify restart preserves database and PPT volumes.
- [ ] Document setup, logs, migrations, seed data, shutdown, and destructive reset commands.
- [ ] Run existing frontend tests, lint, and production build before committing.
