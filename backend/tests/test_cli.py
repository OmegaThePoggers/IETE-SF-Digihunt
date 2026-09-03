"""CLI account administration.

Exercised against a real SQLite-backed session rather than mocks, so the
commands' actual DB effects are observable.
"""

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.core.security import verify_password
from app.models import Team, User
from app.models.enums import UserRole


@pytest.fixture
def db_factory(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/cli.db")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    from app import cli

    monkeypatch.setattr(cli, "SessionLocal", factory)
    return factory


@pytest.fixture
def run(db_factory):
    from app.cli import main

    return main


def test_create_user_makes_a_working_judge_account(run, db_factory, capsys):
    assert run(["create-user", "--role", "judge", "--name", "J", "--email", "j@example.com"]) == 0

    printed = capsys.readouterr().out
    password = _password_from(printed)

    with db_factory() as db:
        user = db.scalar(select(User).where(User.email == "j@example.com"))
        assert user.role == UserRole.judge
        assert user.team_id is None
        # The printed password is the one that actually authenticates.
        assert verify_password(password, user.password_hash)


def test_duplicate_email_is_rejected(run, capsys):
    run(["create-user", "--role", "judge", "--name", "J", "--email", "dup@example.com"])
    capsys.readouterr()

    assert run(["create-user", "--role", "admin", "--name", "A", "--email", "dup@example.com"]) == 1


def test_invalid_email_is_refused_before_creating_anything(run, db_factory):
    """A reserved domain passes a naive check but is rejected by the login
    endpoint's EmailStr, which would create an account nobody can sign in to."""
    with pytest.raises(SystemExit):
        run(["create-user", "--role", "judge", "--name", "J", "--email", "x@test.local"])

    with db_factory() as db:
        assert db.scalar(select(User).where(User.email.like("x@%"))) is None


def test_reset_password_changes_the_hash(run, db_factory, capsys):
    run(["create-user", "--role", "admin", "--name", "A", "--email", "a@example.com"])
    first = _password_from(capsys.readouterr().out)

    assert run(["reset-password", "--email", "a@example.com"]) == 0
    second = _password_from(capsys.readouterr().out)

    assert first != second
    with db_factory() as db:
        user = db.scalar(select(User).where(User.email == "a@example.com"))
        assert verify_password(second, user.password_hash)
        assert not verify_password(first, user.password_hash)


def test_reset_team_password_covers_the_team_and_nobody_else(run, db_factory, capsys):
    with db_factory() as db:
        team = Team(team_code="DGH-042", team_name="Team")
        other = Team(team_code="DGH-043", team_name="Other")
        db.add_all([team, other])
        db.flush()
        db.add_all(
            [
                User(name="M1", email="m1@example.com", password_hash="old",
                     role=UserRole.participant, team_id=team.id),
                User(name="M2", email="m2@example.com", password_hash="old",
                     role=UserRole.participant, team_id=team.id),
                User(name="Out", email="out@example.com", password_hash="old",
                     role=UserRole.participant, team_id=other.id),
            ]
        )
        db.commit()

    assert run(["reset-team-password", "--team-code", "DGH-042"]) == 0
    password = _password_from(capsys.readouterr().out)

    with db_factory() as db:
        for email in ("m1@example.com", "m2@example.com"):
            user = db.scalar(select(User).where(User.email == email))
            assert verify_password(password, user.password_hash)

        outsider = db.scalar(select(User).where(User.email == "out@example.com"))
        assert outsider.password_hash == "old"


def test_reset_team_password_rejects_unknown_team(run):
    assert run(["reset-team-password", "--team-code", "DGH-999"]) == 1


def test_list_users_never_prints_hashes(run, db_factory, capsys):
    run(["create-user", "--role", "judge", "--name", "J", "--email", "j@example.com"])
    capsys.readouterr()

    assert run(["list-users"]) == 0
    out = capsys.readouterr().out
    assert "j@example.com" in out
    assert "$argon2" not in out


def _password_from(output: str) -> str:
    for line in output.splitlines():
        if "password :" in line:
            return line.split("password :")[1].strip()
    raise AssertionError(f"no password in output:\n{output}")
