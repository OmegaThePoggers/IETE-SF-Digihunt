from sqlalchemy.orm import Session

from app.models import Team
from app.services.round_gate import round_fully_solved


def is_master_eligible(db: Session, team: Team) -> bool:
    """The Master Terminal sits between Round 2 and Round 3: a team may
    attempt it once Round 2's MCQ questions exist and are all solved. Passing
    the Master Terminal is what gates Round 3.
    """
    return round_fully_solved(db, team.id, 2)
