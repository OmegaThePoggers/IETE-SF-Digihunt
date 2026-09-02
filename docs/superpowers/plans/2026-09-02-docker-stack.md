# Docker Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Start the complete DigiHunt application with one Docker Compose command.

**Architecture:** Compose orchestrates private PostgreSQL, a migration-aware FastAPI container, and a standalone Next.js container. Named volumes persist database and PowerPoint data, while health checks control startup order.

**Tech Stack:** Docker Engine 29, Docker Compose 5, PostgreSQL 17 Alpine, Python 3.12, uv 0.9.7, Node.js 22, Next.js 16.

---

### Task 1: Add image definitions

**Files:** `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/next.config.ts`

- [x] Enable Next.js `output: "standalone"`.
- [x] Build the backend from its lock file and run it as UID 10001.
- [x] Build the frontend in dependency, build, and runtime stages and run it as `node`.
- [x] Exclude local dependencies, caches, environment files, runtime data, and Git metadata from contexts.
- [x] Build both images successfully.

### Task 2: Add Compose orchestration

**Files:** `compose.yaml`, `.env.docker.example`

- [x] Add PostgreSQL with a health check and persistent volume.
- [x] Add backend migration/start command, API health check, private database URL, CORS configuration, and PPT volume.
- [x] Add frontend build argument, API URL, health check, and backend dependency.
- [x] Validate the rendered Compose configuration.

### Task 3: Validate and document

**Files:** `README.md`

- [x] Start the stack with a clean build.
- [x] Verify container health, database connectivity, backend health JSON, frontend HTML, and writable PPT storage.
- [x] Verify restart preserves database and PPT volumes.
- [x] Document setup, logs, migrations, seed data, shutdown, and destructive reset commands.
- [x] Run existing frontend tests, lint, and production build before committing.
