from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import Question, Submission, Team, TeamQuestion, User
from app.models.enums import TeamQuestionStatus
from app.schemas.team import GateProgress, MemberOut, RoundProgress, RoundsOut, TeamMeOut
from app.services.round_gate import UPLOAD_ROUND, is_round_unlocked
from app.services.round_key import plaintext_key

router = APIRouter(prefix="/teams", tags=["teams"])


def _round_progress(db: Session, team_id, round_num: int, locked: bool) -> RoundProgress:
    solved, total = db.execute(
        select(
            func.count().filter(TeamQuestion.status == TeamQuestionStatus.solved),
            func.count(),
        )
        .select_from(TeamQuestion)
        .join(Question, Question.id == TeamQuestion.question_id)
        .where(TeamQuestion.team_id == team_id, Question.round == round_num)
    ).one()
    return RoundProgress(solved=solved, total=total, locked=locked)


def _upload_round_progress(db: Session, team_id, locked: bool) -> RoundProgress:
    submitted = db.scalar(
        select(Submission.id).where(
            Submission.team_id == team_id, Submission.is_current.is_(True)
        )
    ) is not None
    return RoundProgress(solved=int(submitted), total=1, locked=locked)


@router.get("/me", response_model=TeamMeOut)
def get_my_team(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.team_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no team for this user")

    team = db.get(Team, user.team_id)
    members = db.scalars(select(User).where(User.team_id == user.team_id)).all()

    gates = [
        GateProgress(
            round_number=round_number,
            ready=plaintext_key(db, team, round_number - 1) is not None,
            unlocked=is_round_unlocked(db, team, round_number),
        )
        for round_number in (2, 3, UPLOAD_ROUND)
    ]

    return TeamMeOut(
        team_code=team.team_code,
        team_name=team.team_name,
        members=[
            MemberOut(id=m.id, name=m.name, is_you=(m.id == user.id)) for m in members
        ],
        rounds=RoundsOut(
            round1=_round_progress(db, user.team_id, 1, locked=False),
            round2=_round_progress(
                db, user.team_id, 2, locked=not is_round_unlocked(db, team, 2)
            ),
            round3=_round_progress(
                db, user.team_id, 3, locked=not is_round_unlocked(db, team, 3)
            ),
            round4=_upload_round_progress(
                db, user.team_id, locked=not is_round_unlocked(db, team, UPLOAD_ROUND)
            ),
            gates=gates,
        ),
    )
