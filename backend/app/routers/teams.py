from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import MasterAttempt, Question, Submission, Team, TeamQuestion, User
from app.models.enums import TeamQuestionStatus
from app.schemas.team import MasterProgress, MemberOut, RoundProgress, RoundsOut, TeamMeOut
from app.services.master_gate import is_master_eligible
from app.services.round_gate import is_round_unlocked

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


def _round3_progress(db: Session, team_id, locked: bool) -> RoundProgress:
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
            round3=_round3_progress(
                db, user.team_id, locked=not is_round_unlocked(db, team, 3)
            ),
            master=MasterProgress(
                locked=not is_master_eligible(db, team),
                solved=db.scalar(
                    select(MasterAttempt.id).where(
                        MasterAttempt.team_id == team.id, MasterAttempt.correct.is_(True)
                    )
                )
                is not None,
            ),
        ),
    )
