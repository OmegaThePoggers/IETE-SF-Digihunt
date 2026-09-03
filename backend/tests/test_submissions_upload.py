"""Upload path: streaming to disk, size limit, and temp-file cleanup.

These exercise the real route through TestClient with a temporary
ppt_directory, so the on-disk side effects are observable.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core import deps
from app.core.config import settings
from app.core.db import get_db
from app.main import app
from app.models import Submission, Team, User
from app.models.enums import UserRole
from app.routers import submissions as submissions_router

PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


class _FakeResult:
    def __init__(self, value=None):
        self._value = value

    def all(self):
        return []


class _FakeSession:
    """Minimal stand-in for the ORM session this route uses.

    The upload route only needs: get(Team), scalar() for the existing-current
    and max-version lookups, and add/commit/refresh. Faking it keeps these
    tests focused on the streaming/cleanup behavior without a database.
    """

    def __init__(self, team: Team):
        self._team = team
        self.added: list[object] = []

    def get(self, model, pk):
        if model is Team:
            return self._team
        return None

    def scalar(self, *_args, **_kwargs):
        return None

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        pass

    def refresh(self, obj):
        # Stand in for the DB-side defaults the real session would populate.
        if isinstance(obj, Submission):
            from datetime import datetime, timezone

            if obj.id is None:
                obj.id = uuid.uuid4()
            if obj.submitted_at is None:
                obj.submitted_at = datetime.now(timezone.utc)


@pytest.fixture
def ppt_dir(tmp_path, monkeypatch):
    target = tmp_path / "ppts"
    target.mkdir()
    monkeypatch.setattr(settings, "ppt_directory", str(target))
    return target


@pytest.fixture
def client(ppt_dir):
    team = Team(id=uuid.uuid4(), team_code="DGH-001", team_name="Test Team")
    user = User(
        id=uuid.uuid4(),
        name="Tester",
        email="t@example.com",
        password_hash="x",
        role=UserRole.participant,
        team_id=team.id,
    )
    session = _FakeSession(team)

    app.dependency_overrides[submissions_router._require_team] = lambda: user
    app.dependency_overrides[get_db] = lambda: session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _upload(client, content: bytes, name="deck.pptx"):
    return client.post("/submissions", files={"file": (name, content, PPTX_MIME)})


def test_upload_writes_file_and_leaves_no_temp_files(client, ppt_dir):
    res = _upload(client, b"a" * 2048)

    assert res.status_code == 200, res.text
    written = list(ppt_dir.glob("*.pptx"))
    assert len(written) == 1
    assert written[0].read_bytes() == b"a" * 2048
    assert list(ppt_dir.glob("*.part")) == []


def test_oversize_upload_is_rejected_and_cleans_up(client, ppt_dir, monkeypatch):
    """The RAM-exhaustion guard: oversize input must not be retained, and
    must not leave a partial file behind."""
    monkeypatch.setattr(settings, "max_upload_bytes", 1024)

    res = _upload(client, b"b" * 4096)

    assert res.status_code == 413
    assert list(ppt_dir.iterdir()) == []


def test_size_limit_defaults_to_one_gigabyte():
    assert settings.max_upload_bytes == 1024 * 1024 * 1024


def test_non_powerpoint_extension_is_rejected(client, ppt_dir):
    res = client.post(
        "/submissions", files={"file": ("evil.exe", b"x", PPTX_MIME)}
    )

    assert res.status_code == 400
    assert list(ppt_dir.iterdir()) == []


def test_traversal_filename_cannot_escape_the_ppt_directory(client, ppt_dir):
    res = _upload(client, b"c" * 16, name="../../../../etc/passwd.pptx")

    assert res.status_code == 200, res.text
    written = list(ppt_dir.glob("*.pptx"))
    assert len(written) == 1
    # Sanitization collapsed the traversal into the flat destination dir.
    assert written[0].parent == ppt_dir
