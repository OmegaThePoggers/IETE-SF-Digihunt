# uv Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pip requirements and manually managed virtual environments with a reproducible Python 3.12 uv project, then document local and hosted usage.

**Architecture:** `backend/pyproject.toml` becomes the only human-edited dependency manifest and `backend/uv.lock` pins the resolved graph. uv owns `backend/.venv`; application code and startup interfaces remain unchanged. Validation uses a clean locked sync, Python compilation, Alembic inspection, and FastAPI application import.

**Tech Stack:** Python 3.12, uv 0.9+, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL/psycopg

---

## File map

- Create `backend/pyproject.toml`: project metadata, Python requirement, runtime dependencies, uv application configuration.
- Create `backend/uv.lock`: generated reproducible dependency graph.
- Delete `backend/requirements.txt`: remove the duplicate dependency source.
- Modify `.gitignore`: ignore uv's `backend/.venv/` directory while retaining the legacy `backend/venv/` ignore.
- Modify `README.md`: replace pip setup and seed commands; add dependency management and hosting guidance.

### Task 1: Establish the uv dependency manifest

**Files:**
- Create: `backend/pyproject.toml`
- Delete: `backend/requirements.txt`

- [ ] **Step 1: Record the current dependency contract**

Run:

```bash
cat backend/requirements.txt
```

Expected: the eleven existing direct dependencies are visible before migration.

- [ ] **Step 2: Create the application manifest**

Create `backend/pyproject.toml`:

```toml
[project]
name = "digihunt-backend"
version = "0.1.0"
description = "FastAPI backend for the DigiHunt event platform"
requires-python = ">=3.12,<3.13"
dependencies = [
    "alembic",
    "argon2-cffi",
    "email-validator",
    "fastapi",
    "psycopg[binary]",
    "pydantic",
    "pydantic-settings",
    "pyjwt",
    "python-multipart",
    "sqlalchemy>=2.0",
    "uvicorn[standard]",
]

[tool.uv]
package = false
```

- [ ] **Step 3: Confirm uv can parse and resolve the manifest**

Run:

```bash
cd backend
uv lock --check
```

Expected: failure because `uv.lock` has not been generated yet, proving the lockfile requirement is enforced.

- [ ] **Step 4: Remove the obsolete manifest**

Run:

```bash
rm backend/requirements.txt
```

Expected: `git status --short` shows a deleted requirements file and a new pyproject file.

- [ ] **Step 5: Commit the manifest transition**

```bash
git add backend/pyproject.toml backend/requirements.txt
git commit -m "build(backend): migrate dependency manifest to uv"
```

### Task 2: Generate and validate the locked Python 3.12 environment

**Files:**
- Create: `backend/uv.lock`
- Modify: `.gitignore`

- [ ] **Step 1: Ignore the uv-managed environment**

Add beneath the backend section of `.gitignore`:

```gitignore
backend/.venv/
```

- [ ] **Step 2: Generate the lockfile**

Run:

```bash
cd backend
uv lock
```

Expected: uv resolves the dependency graph and creates `backend/uv.lock` with `requires-python = ">=3.12, <3.13"`.

- [ ] **Step 3: Verify locked mode rejects no drift**

Run:

```bash
cd backend
uv lock --check
```

Expected: exit code 0 with no lockfile changes.

- [ ] **Step 4: Build a clean project environment**

Run:

```bash
rm -rf backend/.venv
cd backend
uv sync --locked --no-dev
```

Expected: uv selects or downloads Python 3.12, creates `backend/.venv`, and installs all locked runtime packages.

- [ ] **Step 5: Verify interpreter and key packages**

Run:

```bash
cd backend
uv run --no-sync python -c 'import sys, fastapi, sqlalchemy, alembic, psycopg; assert sys.version_info[:2] == (3, 12); print(sys.version.split()[0], fastapi.__version__, sqlalchemy.__version__)'
```

Expected: prints Python 3.12 and installed FastAPI/SQLAlchemy versions without an exception.

- [ ] **Step 6: Commit the reproducible environment files**

```bash
git add .gitignore backend/uv.lock
git commit -m "build(backend): lock uv environment"
```

### Task 3: Update setup and hosting documentation

**Files:**
- Modify: `README.md:23-47`

- [ ] **Step 1: Replace backend local setup instructions**

Document these commands in `README.md`:

```bash
cd backend
cp .env.example .env
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

State that uv creates and manages `backend/.venv` automatically and link to `https://docs.astral.sh/uv/getting-started/installation/` for uv installation.

- [ ] **Step 2: Replace the seed command**

Use:

```bash
cd backend
uv run python -m app.seed
```

- [ ] **Step 3: Add dependency management guidance**

Document:

```bash
uv add <package>
uv remove <package>
uv lock --upgrade
uv sync --locked
```

Explain that `pyproject.toml` is edited through uv commands and `uv.lock` must be committed.

- [ ] **Step 4: Add web-hosting commands and runtime guidance**

Document build, migration, and start commands:

```bash
uv sync --locked --no-dev
uv run --no-sync alembic upgrade head
uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Explain that migrations should run once in a release/pre-deploy phase, not from every web process. Note that uv speeds builds and dependency setup but does not increase request-time FastAPI performance.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md
git commit -m "docs: document uv backend workflow"
```

### Task 4: Verify the complete migration

**Files:**
- Verify: `backend/pyproject.toml`
- Verify: `backend/uv.lock`
- Verify: `README.md`

- [ ] **Step 1: Verify dependency files and locked installation**

Run:

```bash
test -f backend/pyproject.toml
test -f backend/uv.lock
test ! -e backend/requirements.txt
cd backend
uv lock --check
uv sync --locked --no-dev
```

Expected: all commands exit 0 and the lockfile remains unchanged.

- [ ] **Step 2: Compile backend modules**

Run:

```bash
cd backend
uv run --no-sync python -m compileall -q app alembic
```

Expected: exit code 0 with no syntax errors.

- [ ] **Step 3: Inspect Alembic configuration without changing data**

Run:

```bash
cd backend
uv run --no-sync alembic heads
```

Expected: prints the repository's migration head (`9ff48c00f29c`) and exits 0.

- [ ] **Step 4: Import the FastAPI application**

Run:

```bash
cd backend
uv run --no-sync python -c 'from app.main import app; assert app.title; assert len(app.routes) > 0; print(app.title, len(app.routes))'
```

Expected: prints the application title and a positive route count.

- [ ] **Step 5: Check patch quality and repository state**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only unrelated pre-existing untracked files such as `PLANV2.md` remain.
