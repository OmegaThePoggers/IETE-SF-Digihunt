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

from app.core.config import settings

# Sized for a live event: a whole venue commonly shares one NAT address, so
# every participant looks like the same client IP. Limits that assume one
# human per IP would throttle the entire room.
DEFAULT_LIMIT = 600
WINDOW_SECONDS = 60

# path -> (max requests, window seconds). Checked by exact path match; falls
# back to DEFAULT_LIMIT/WINDOW_SECONDS for anything not listed here.
TIGHT_LIMITS: dict[str, tuple[int, int]] = {
    "/auth/login": (120, 60),
    "/auth/register-team": (60, 60),
}

# Sweep idle buckets occasionally. Without this, `_hits` grows one entry per
# (ip, path) pair for the lifetime of the process and never shrinks — a slow
# leak over a multi-hour event.
_SWEEP_EVERY = 1000


def _client_ip(request: Request) -> str:
    """Real client IP.

    In production the app sits behind nginx, which sets X-Forwarded-For to
    the true client address (itself resolved from Cloudflare's
    CF-Connecting-IP header). Without this, `request.client.host` is the
    proxy's address, identical for every user, so all traffic shares one
    bucket and the first few requests exhaust the limit for everyone.

    The header is only trusted in production, where a proxy is known to set
    it. In development any client could spoof it, so the peer address is
    used instead.
    """
    if settings.is_production:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Left-most entry is the original client; the rest are proxies.
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # (ip, path) -> deque[timestamp]
        self._hits: dict[tuple[str, str], deque] = defaultdict(deque)
        self._requests_since_sweep = 0

    def _sweep(self, now: float) -> None:
        """Drop buckets whose timestamps have all aged out."""
        stale = [
            key
            for key, hits in self._hits.items()
            if not hits or now - hits[-1] > WINDOW_SECONDS
        ]
        for key in stale:
            del self._hits[key]

    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = _client_ip(request)
        path = request.url.path
        limit, window = TIGHT_LIMITS.get(path, (DEFAULT_LIMIT, WINDOW_SECONDS))

        key = (client_ip, path)
        now = time.monotonic()

        self._requests_since_sweep += 1
        if self._requests_since_sweep >= _SWEEP_EVERY:
            self._requests_since_sweep = 0
            self._sweep(now)

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
