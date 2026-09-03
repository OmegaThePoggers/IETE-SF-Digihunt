import time

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.core import rate_limit
from app.core.rate_limit import RateLimitMiddleware


def _app() -> Starlette:
    async def ok(request):
        return PlainTextResponse("ok")

    app = Starlette(routes=[Route("/ping", ok), Route("/auth/login", ok, methods=["GET"])])
    app.add_middleware(RateLimitMiddleware)
    return app


@pytest.fixture
def client():
    return TestClient(_app())


def test_forwarded_clients_get_independent_buckets_in_production(monkeypatch, client):
    """The event killer this guards against: behind a proxy every request
    carries the proxy's peer address, so without X-Forwarded-For handling all
    participants share one bucket and the room is throttled as one client."""
    monkeypatch.setattr(rate_limit.settings, "app_env", "production")
    monkeypatch.setattr(rate_limit, "TIGHT_LIMITS", {"/ping": (2, 60)})

    for _ in range(2):
        assert client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    # Same client is now limited...
    assert client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 429
    # ...but a different participant behind the same proxy is unaffected.
    assert client.get("/ping", headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 200


def test_forwarded_header_is_ignored_outside_production(monkeypatch, client):
    """In development the header is untrusted, so spoofing it must not mint
    a fresh bucket."""
    monkeypatch.setattr(rate_limit.settings, "app_env", "development")
    monkeypatch.setattr(rate_limit, "TIGHT_LIMITS", {"/ping": (2, 60)})

    for _ in range(2):
        assert client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert client.get("/ping", headers={"X-Forwarded-For": "9.9.9.9"}).status_code == 429


def test_first_hop_is_used_when_several_proxies_appended(monkeypatch, client):
    monkeypatch.setattr(rate_limit.settings, "app_env", "production")
    monkeypatch.setattr(rate_limit, "TIGHT_LIMITS", {"/ping": (1, 60)})

    assert client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1, 10.0.0.1"}).status_code == 200
    assert client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1, 10.0.0.9"}).status_code == 429


def test_login_limit_allows_a_venue_sharing_one_address(monkeypatch, client):
    """200 participants behind one NAT address must all be able to sign in."""
    monkeypatch.setattr(rate_limit.settings, "app_env", "production")

    limit, _window = rate_limit.TIGHT_LIMITS["/auth/login"]
    assert limit >= 100

    for _ in range(100):
        assert client.get("/auth/login", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200


def test_idle_buckets_are_swept(monkeypatch):
    """Bounded memory: a multi-hour event must not accumulate one permanent
    entry per (ip, path) pair."""
    middleware = RateLimitMiddleware(_app())
    middleware._hits[("stale", "/ping")].append(time.monotonic() - 3600)
    middleware._hits[("fresh", "/ping")].append(time.monotonic())

    middleware._sweep(time.monotonic())

    assert ("stale", "/ping") not in middleware._hits
    assert ("fresh", "/ping") in middleware._hits
