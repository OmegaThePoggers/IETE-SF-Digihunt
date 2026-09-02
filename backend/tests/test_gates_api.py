import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_gate_for_round_one_is_not_addressable(client):
    res = client.get("/gates/1")
    # 401 (no auth) or 404 (no gate) are both correct rejections; what must
    # never happen is a 200 exposing a gate for the always-open round.
    assert res.status_code in (401, 404)


def test_gate_for_round_two_requires_auth(client):
    res = client.get("/gates/2")
    assert res.status_code == 401
