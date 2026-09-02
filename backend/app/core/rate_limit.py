"""In-memory fixed-window rate limiting, keyed by (client IP, route path).

ponytail: single-process/in-memory only — a dict of deque timestamps held in
this worker's memory. Correct for one `uvicorn` process; if this is ever run
with multiple workers (`--workers N`) or behind a load balancer with several
app instances, each process gets its own independent counters and the real
per-client limit becomes N times higher than configured. Fine for this
deployment (single worker). Upgrade path: move the counters into Redis
(`INCR` + `EXPIRE`, or a Lua token-bucket script) shared across processes if
this ever needs to scale horizontally.
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

DEFAULT_LIMIT = 60
WINDOW_SECONDS = 60

# path -> (max requests, window seconds). Checked by exact path match; falls
# back to DEFAULT_LIMIT/WINDOW_SECONDS for anything not listed here.
TIGHT_LIMITS: dict[str, tuple[int, int]] = {
    "/auth/login": (10, 60),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # (ip, path) -> deque[timestamp]
        self._hits: dict[tuple[str, str], deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        limit, window = TIGHT_LIMITS.get(path, (DEFAULT_LIMIT, WINDOW_SECONDS))

        key = (client_ip, path)
        now = time.monotonic()
        hits = self._hits[key]

        # drop timestamps outside the current window
        while hits and now - hits[0] > window:
            hits.popleft()

        if len(hits) >= limit:
            retry_after = max(1, int(window - (now - hits[0])))
            return JSONResponse(
                {"detail": "Too many requests, please slow down"},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)
        return await call_next(request)
