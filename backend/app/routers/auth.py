from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Team, User
from app.models.enums import UserRole
from app.schemas.auth import (
    LoginIn,
    MeOut,
    RegisterTeamIn,
    RegisterTeamOut,
    TokenOut,
)
from app.services.team_code import generate_team_code

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register-team", response_model=RegisterTeamOut)
def register_team(payload: RegisterTeamIn, db: Session = Depends(get_db)):
    if db.scalar(select(Team.id).where(Team.team_name == payload.team_name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "team_name already taken")

    emails = [m.email.lower() for m in payload.members]
    existing = db.scalar(select(User.id).where(User.email.in_(emails)))
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "one or more member emails already registered"
        )

    team = Team(team_code=generate_team_code(db), team_name=payload.team_name)
    db.add(team)
    db.flush()  # assign team.id

    password_hash = hash_password(payload.team_password)
    users = [
        User(
            name=m.name,
            email=m.email.lower(),
            password_hash=password_hash,
            role=UserRole.participant,
            team_id=team.id,
        )
        for m in payload.members
    ]
    db.add_all(users)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "team name or member email already registered"
        )

    return RegisterTeamOut(
        team_code=team.team_code,
        team_name=team.team_name,
        members=[{"name": u.name, "email": u.email} for u in users],
    )


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    invalid = HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")

    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    team_code = None
    if user.team_id is not None:
        team_code = db.scalar(select(Team.team_code).where(Team.id == user.team_id))

    token = create_access_token(
        user_id=str(user.id),
        role=user.role.value,
        team_id=str(user.team_id) if user.team_id else None,
    )
    return TokenOut(access_token=token, role=user.role.value, team_code=team_code)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team_code = None
    if user.team_id is not None:
        team_code = db.scalar(select(Team.team_code).where(Team.id == user.team_id))

    return MeOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.value,
        team_id=user.team_id,
        team_code=team_code,
    )
