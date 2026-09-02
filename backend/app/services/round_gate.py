"""Single source of truth for round-unlock state — used by both the
enforcement dependency (deps.require_round_unlocked) and the dashboard
display (teams.py) so they can never disagree."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import MasterAttempt, Question, Team, TeamQuestion
from app.models.enums import TeamQuestionStatus


def round_fully_solved(db: Session, team_id, round_number: int) -> bool:
    """True iff `round_number` has TeamQuestions assigned and every one of
    them is solved. Shared by is_round_unlocked (round 2's gate = round 1
    fully solved) and master_gate.is_master_eligible (master terminal's gate
    = round 2 fully solved) so the "is a round complete" definition lives in
    exactly one place.
    """
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
    if round_number == 1:
        return True

    if round_number == 3:
        # Round 3 now unlocks by passing the Master Terminal (which itself
        # gates on Round 2 completion — see master_gate.is_master_eligible),
        # not directly by Round 2 completion.
        return (
            db.scalar(
                select(MasterAttempt.id).where(
                    MasterAttempt.team_id == team.id, MasterAttempt.correct.is_(True)
                )
            )
            is not None
        )

    return round_fully_solved(db, team.id, round_number - 1)
