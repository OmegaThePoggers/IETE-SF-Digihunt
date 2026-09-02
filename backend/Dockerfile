FROM ghcr.io/astral-sh/uv:0.9.7 AS uv

FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=uv /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN groupadd --gid 10001 digihunt \
    && useradd --uid 10001 --gid digihunt --create-home --shell /usr/sbin/nologin digihunt \
    && mkdir -p /data/uploads /data/ppts \
    && chown -R digihunt:digihunt /app /data

USER digihunt

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
