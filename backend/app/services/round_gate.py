"""Single source of truth for round-unlock state.

Round 1 is always open. Every later round opens only when the team has
solved the previous round's anagram key, recorded as a RoundUnlock row
(see app.services.round_key and app.routers.gates).
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Question, RoundUnlock, Team, TeamQuestion
from app.models.enums import TeamQuestionStatus

ROUND_COUNT = 4
MCQ_ROUNDS = (1, 2, 3)
UPLOAD_ROUND = 4


def requires_gate(round_number: int) -> bool:
    return round_number > 1


def round_fully_solved(db: Session, team_id, round_number: int) -> bool:
    """True iff `round_number` has TeamQuestions assigned and every one of
    them is solved."""
    total, solved = db.execute(
        select(
            func.count(),
            func.count().filter(TeamQuestion.status == TeamQuestionStatus.solved),
        )
        .select_from(TeamQuestion)
        .join(Question, Question.id == TeamQuestion.question_id)
        .where(TeamQuestion.team_id == team_id, Question.round == round_number)
    ).one()

    # total == 0 must NOT count as "complete" (vacuous truth guard).
    return total > 0 and total == solved


def is_round_unlocked(db: Session, team: Team, round_number: int) -> bool:
    if not requires_gate(round_number):
        return True
    return (
        db.scalar(
            select(RoundUnlock.id).where(
                RoundUnlock.team_id == team.id,
                RoundUnlock.round_number == round_number,
            )
        )
        is not None
    )
