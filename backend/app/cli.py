"""Server-side account administration.

Run on the server, e.g.:

    docker compose exec backend python -m app.cli list-users
    docker compose exec backend python -m app.cli create-user --role judge --name "Dr Rao" --email rao@example.com
    docker compose exec backend python -m app.cli reset-team-password --team-code DGH-001

Why a CLI and not an admin HTTP route: password reset and account creation
are the two most dangerous operations in the system. Behind an endpoint they
are one leaked admin token away from full takeover. Behind a CLI they require
shell access to the server, which is a far stronger boundary for a one-day
event.

Passwords are always generated here and printed exactly once. They are never
accepted as arguments, so they cannot leak into shell history, and never
stored anywhere but the Argon2 hash.
"""

import argparse
import logging
import secrets
import sys

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import Team, User
from app.models.enums import UserRole

logger = logging.getLogger("digihunt.cli")

PASSWORD_BYTES = 12


def _normalize_email(raw: str) -> str:
    """Apply the same validation the login endpoint uses.

    Without this the CLI could happily create an account whose address the
    API's EmailStr rejects at login, producing an account that can never
    sign in. Failing here, at creation time, is far cheaper than discovering
    it when a judge tries to log in mid-event.
    """
    try:
        return validate_email(raw.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise SystemExit(f"error: invalid email {raw!r}: {exc}")


def _generate_password() -> str:
    return secrets.token_urlsafe(PASSWORD_BYTES)


def _print_credentials(email: str, password: str, note: str) -> None:
    print()
    print("=" * 56)
    print(f"  {note}")
    print(f"  email    : {email}")
    print(f"  password : {password}")
    print("=" * 56)
    print("  Shown once. Copy it now; it cannot be recovered later.")
    print()


def create_user(args) -> int:
    role = UserRole(args.role)
    email = _normalize_email(args.email)

    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == email)):
            print(f"error: {email} is already registered", file=sys.stderr)
            return 1

        password = _generate_password()
        db.add(
            User(
                name=args.name,
                email=email,
                password_hash=hash_password(password),
                role=role,
                team_id=None,
            )
        )
        db.commit()

    logger.warning("cli: created %s account for %s", role.value, email)
    _print_credentials(email, password, f"{role.value.upper()} ACCOUNT CREATED")
    return 0


def reset_password(args) -> int:
    email = _normalize_email(args.email)

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"error: no account for {email}", file=sys.stderr)
            return 1

        password = _generate_password()
        user.password_hash = hash_password(password)
        db.commit()

    logger.warning("cli: password reset for %s", email)
    _print_credentials(email, password, "PASSWORD RESET")
    return 0


def reset_team_password(args) -> int:
    """Team members share one password (see auth.register_team), so a reset
    necessarily applies to every member of the team."""
    code = args.team_code.upper().strip()

    with SessionLocal() as db:
        team = db.scalar(select(Team).where(Team.team_code == code))
        if team is None:
            print(f"error: no team with code {code}", file=sys.stderr)
            return 1

        members = db.scalars(select(User).where(User.team_id == team.id)).all()
        if not members:
            print(f"error: team {code} has no members", file=sys.stderr)
            return 1

        password = _generate_password()
        password_hash = hash_password(password)
        for member in members:
            member.password_hash = password_hash
        db.commit()

        emails = [m.email for m in members]
        team_name = team.team_name

    logger.warning("cli: team password reset for %s (%d members)", code, len(emails))
    print()
    print("=" * 56)
    print(f"  TEAM PASSWORD RESET — {code} ({team_name})")
    print(f"  password : {password}")
    print("  members  :")
    for email in emails:
        print(f"    - {email}")
    print("=" * 56)
    print("  Shown once. Any member can sign in with this password.")
    print()
    return 0


def list_users(args) -> int:
    with SessionLocal() as db:
        rows = db.execute(
            select(User, Team.team_code)
            .outerjoin(Team, Team.id == User.team_id)
            .order_by(User.role, User.email)
        ).all()

        if not rows:
            print("no users")
            return 0

        print(f"{'ROLE':<12} {'EMAIL':<32} {'TEAM':<10} LAST LOGIN")
        for user, team_code in rows:
            last = user.last_login.strftime("%Y-%m-%d %H:%M") if user.last_login else "never"
            print(f"{user.role.value:<12} {user.email:<32} {team_code or '-':<10} {last}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli", description="DigiHunt account administration"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-user", help="create an admin or judge account")
    create.add_argument("--role", required=True, choices=["admin", "judge"])
    create.add_argument("--name", required=True)
    create.add_argument("--email", required=True)
    create.set_defaults(func=create_user)

    reset = sub.add_parser("reset-password", help="reset one account's password")
    reset.add_argument("--email", required=True)
    reset.set_defaults(func=reset_password)

    team_reset = sub.add_parser(
        "reset-team-password", help="reset the shared password for a team"
    )
    team_reset.add_argument("--team-code", required=True)
    team_reset.set_defaults(func=reset_team_password)

    listing = sub.add_parser("list-users", help="list accounts (never shows hashes)")
    listing.set_defaults(func=list_users)

    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
