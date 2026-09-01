# uv Backend Dependency Management Design

## Goal

Make the DigiHunt FastAPI backend faster and more reproducible to install locally, in CI, and on hosting platforms by adopting Astral uv as the sole Python dependency manager.

## Scope

- Target CPython 3.12.
- Replace `backend/requirements.txt` with `backend/pyproject.toml` and a committed `backend/uv.lock`.
- Preserve the backend's current runtime dependency set.
- Update the root `README.md` with local development, database migration, seed, dependency update, and hosting commands.
- Ignore uv's project virtual environment at `backend/.venv/`.

No application behavior, database schema, API contract, or frontend code will change.

## Dependency model

`backend/pyproject.toml` will be the human-edited source of truth. Runtime packages will remain direct project dependencies with conservative lower bounds where the existing file already expresses one. `uv.lock` will pin the full resolved dependency graph for reproducible installations.

The project will not be packaged as an installable Python distribution because the backend is an application. uv commands will therefore use `--no-install-project` where appropriate.

## Developer workflow

From `backend/`:

```bash
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Seeding will use `uv run python -m app.seed`. Dependency changes will use `uv add`, `uv remove`, and `uv lock --upgrade` rather than direct lockfile edits.

## Hosting workflow

Recommended build command:

```bash
uv sync --locked --no-dev --no-install-project
```

Recommended start command:

```bash
uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Migrations must run as a release/pre-deploy command when the hosting provider supports one:

```bash
uv run --no-sync alembic upgrade head
```

uv improves dependency resolution, download, and environment creation during builds. It does not materially change FastAPI runtime performance. A host without uv preinstalled must install the uv binary in its build environment or use a platform-native uv integration.

## Verification

1. Generate the lockfile under the Python 3.12 requirement.
2. Remove any existing `backend/.venv`, then run `uv sync --locked` to prove clean setup.
3. Verify imports and compile all backend Python modules through the uv environment.
4. Run Alembic configuration/history checks without mutating production data.
5. Import the FastAPI application and confirm its routes can be constructed.
6. Confirm README commands match the resulting files and CLI behavior.

## Risks and mitigations

- **Host lacks uv:** document installation/provider integration and keep all commands explicit.
- **Accidental dependency drift:** commit `uv.lock` and use `--locked` in CI and hosting.
- **Wrong interpreter:** enforce `requires-python = ">=3.12,<3.13"`; uv can download a compatible interpreter when needed.
- **Migration race during startup:** document migrations as a separate release step rather than running them in every web process.
