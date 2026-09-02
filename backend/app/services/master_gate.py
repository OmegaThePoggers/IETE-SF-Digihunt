from sqlalchemy.orm import Session

from app.models import Team
from app.services.round_gate import round2_fully_approved


def is_master_eligible(db: Session, team: Team) -> bool:
    """The Master Terminal sits between Round 2 and Round 3: a team may
    attempt it once Round 2's TeamQuestions exist and are all solved. This
    used to be the condition gating Round 3 directly (see
    round_gate.is_round_unlocked); it now gates the Master Terminal instead,
    and passing the Master Terminal is what gates Round 3.
    """
    return round2_fully_approved(db, team.id)
