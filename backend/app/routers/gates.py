"""Cipher gates between rounds.

Finishing round N-1 produces a per-team key; the team sees it scrambled and
must submit the unscrambled form to open round N. This replaces the old
one-off Master Terminal so there is a single unlock concept in the system.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import RoundKeyAttempt, RoundUnlock, Team, User
from app.schemas.gate import GateStatusOut, GateUnlockIn, GateUnlockOut
from app.services.round_gate import ROUND_COUNT, requires_gate
from app.services.round_key import keys_match, plaintext_key, scramble_key
from app.websocket.manager import broadcast_from_sync

router = APIRouter(prefix="/gates", tags=["gates"])


def _require_team(user: User = Depends(get_current_user)) -> User:
    if user.team_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no team for this user")
    return user


def _validate_round(round_number: int) -> int:
    if not (2 <= round_number <= ROUND_COUNT) or not requires_gate(round_number):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No gate for that round")
    return round_number


def _is_unlocked(db: Session, team_id, round_number: int) -> bool:
    return (
        db.scalar(
            select(RoundUnlock.id).where(
                RoundUnlock.team_id == team_id, RoundUnlock.round_number == round_number
            )
        )
        is not None
    )


@router.get("/{round_number}", response_model=GateStatusOut)
def get_gate(
    round_number: int,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    _validate_round(round_number)
    team = db.get(Team, user.team_id)
    source_round = round_number - 1

    unlocked = _is_unlocked(db, team.id, round_number)
    plain = plaintext_key(db, team, source_round)
    attempts = db.scalar(
        select(func.count())
        .select_from(RoundKeyAttempt)
        .where(
            RoundKeyAttempt.team_id == team.id,
            RoundKeyAttempt.round_number == round_number,
        )
    )

    return GateStatusOut(
        round_number=round_number,
        source_round=source_round,
        ready=plain is not None,
        unlocked=unlocked,
        # SECURITY: only the scrambled form is ever sent to the client. The
        # plaintext never leaves the server until the team submits it back.
        scrambled_key=(
            scramble_key(plain, team.team_code, source_round)
            if plain is not None and not unlocked
            else None
        ),
        attempts=attempts or 0,
    )


@router.post("/{round_number}/unlock", response_model=GateUnlockOut)
def unlock_gate(
    round_number: int,
    payload: GateUnlockIn,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    _validate_round(round_number)
    team = db.get(Team, user.team_id)
    source_round = round_number - 1

    if _is_unlocked(db, team.id, round_number):
        return GateUnlockOut(
            correct=True, message=f"Round {round_number} already unlocked", unlocked=True
        )

    plain = plaintext_key(db, team, source_round)
    if plain is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, f"Finish Round {source_round} first"
        )

    correct = keys_match(payload.key, plain)
    db.add(
        RoundKeyAttempt(
            team_id=team.id,
            user_id=user.id,
            round_number=round_number,
            submitted=payload.key[:120],
            correct=correct,
        )
    )
    if correct:
        db.add(
            RoundUnlock(team_id=team.id, round_number=round_number, unlocked_by=user.id)
        )
    db.commit()

    if not correct:
        return GateUnlockOut(
            correct=False, message="KEY REJECTED — the letters do not match", unlocked=False
        )

    broadcast_from_sync(
        team.id, {"type": "round_unlocked", "round_number": round_number}
    )
    return GateUnlockOut(
        correct=True, message=f"KEY ACCEPTED — Round {round_number} unlocked", unlocked=True
    )
