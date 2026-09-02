import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_round_unlocked
from app.models import Attempt, EventSettings, Question, Team, TeamQuestion, User
from app.models.enums import TeamQuestionStatus
from app.schemas.question import AnswerIn, AnswerOut, QuestionBoardItem, RoundBoardOut
from app.services.question_gen import assign_round1, assign_round2, compute_access_key
from app.services.round_gate import is_round_unlocked
from app.websocket.manager import broadcast_from_sync

router = APIRouter(prefix="/questions", tags=["questions"])

DEFAULT_CLAIM_MINUTES = 5


def _claim_minutes(db: Session) -> int:
    """Reads admin-configurable EventSettings["question_claim_timeout_minutes"],
    falling back to the default if missing or not a valid int (G8: this is
    what the old hardcoded CLAIM_MINUTES constant deferred to)."""
    row = db.get(EventSettings, "question_claim_timeout_minutes")
    if row is None:
        return DEFAULT_CLAIM_MINUTES
    try:
        return int(row.value)
    except (TypeError, ValueError):
        return DEFAULT_CLAIM_MINUTES


def _require_team(user: User = Depends(get_current_user)) -> User:
    if user.team_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no team for this user")
    return user


def _get_owned_team_question(
    db: Session, team_question_id: uuid.UUID, team_id: uuid.UUID
) -> TeamQuestion:
    tq = db.get(TeamQuestion, team_question_id)
    if tq is None or tq.team_id != team_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "question not found")
    return tq


@router.get("/round/1", response_model=RoundBoardOut)
def get_round1_board(
    user: User = Depends(_require_team), db: Session = Depends(get_db)
):
    team = db.get(Team, user.team_id)
    team_questions = assign_round1(db, team)

    members = db.scalars(select(User).where(User.team_id == user.team_id)).all()
    name_by_id = {m.id: m.name for m in members}

    items: list[QuestionBoardItem] = []
    all_solved = True
    for tq in team_questions:
        q = tq.question
        status_val = tq.status.value
        solved = status_val == "solved"
        if not solved:
            all_solved = False
        # assigned_to persists through the solve transition (never cleared),
        # so this doubles as "being solved by" (claimed) and "solved by"
        # (solved) without needing a separate field.
        claimed_name = name_by_id.get(tq.assigned_to) if tq.assigned_to else None
        items.append(
            QuestionBoardItem(
                team_question_id=tq.id,
                category=q.category,
                difficulty=q.difficulty,
                question_text=q.question_text,
                options=q.options,
                status=status_val,
                claimed_by_name=claimed_name,
                code_fragment=q.code_fragment if solved else None,
                judge_approved=None,
            )
        )

    all_complete = all_solved and bool(team_questions)
    access_key = compute_access_key(db, team)

    return RoundBoardOut(
        questions=items, all_complete=all_complete, access_key=access_key
    )


@router.get("/round/2", response_model=RoundBoardOut)
def get_round2_board(
    user: User = Depends(require_round_unlocked(2)), db: Session = Depends(get_db)
):
    team = db.get(Team, user.team_id)
    team_questions = assign_round2(db, team)

    members = db.scalars(select(User).where(User.team_id == user.team_id)).all()
    name_by_id = {m.id: m.name for m in members}

    items: list[QuestionBoardItem] = []
    summary: dict[str, str] = {}
    all_solved = True
    for tq in team_questions:
        q = tq.question
        status_val = tq.status.value
        solved = status_val == "solved"
        if not solved:
            all_solved = False
        claimed_name = name_by_id.get(tq.assigned_to) if tq.assigned_to else None
        items.append(
            QuestionBoardItem(
                team_question_id=tq.id,
                category=q.category,
                difficulty=q.difficulty,
                question_text=q.question_text,
                options=q.options,
                status=status_val,
                claimed_by_name=claimed_name,
                code_fragment=None,  # Round 2 has no access-key fragments
                judge_approved=tq.judge_approved,
            )
        )
        if solved:
            summary[q.category] = q.correct_answer

    all_complete = all_solved and bool(team_questions)

    return RoundBoardOut(
        questions=items,
        all_complete=all_complete,
        investigation_complete=all_complete,
        summary=summary if all_complete else None,
        awaiting_judge_approval=all_complete and any(
            tq.judge_approved is not True for tq in team_questions
        ),
    )


@router.post("/{team_question_id}/claim")
def claim_question(
    team_question_id: uuid.UUID,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    _get_owned_team_question(db, team_question_id, user.team_id)

    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=_claim_minutes(db))
    stmt = (
        update(TeamQuestion)
        .where(
            TeamQuestion.id == team_question_id,
            TeamQuestion.team_id == user.team_id,
            (TeamQuestion.status == TeamQuestionStatus.available)
            | (
                (TeamQuestion.status == TeamQuestionStatus.claimed)
                & (TeamQuestion.claim_expires_at < now)
            ),
        )
        .values(
            status=TeamQuestionStatus.claimed,
            assigned_to=user.id,
            claim_expires_at=expires,
        )
        .returning(TeamQuestion.id)
    )
    row = db.execute(stmt).first()
    db.commit()
    if row is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Clue currently in use")
    broadcast_from_sync(
        user.team_id,
        {
            "type": "question_claimed",
            "team_question_id": str(team_question_id),
            "user_id": str(user.id),
            "name": user.name,
        },
    )
    return {"status": "claimed", "claim_expires_at": expires}


@router.post("/{team_question_id}/release")
def release_question(
    team_question_id: uuid.UUID,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    _get_owned_team_question(db, team_question_id, user.team_id)

    stmt = (
        update(TeamQuestion)
        .where(
            TeamQuestion.id == team_question_id,
            TeamQuestion.status == TeamQuestionStatus.claimed,
            TeamQuestion.assigned_to == user.id,
        )
        .values(status=TeamQuestionStatus.available, assigned_to=None, claim_expires_at=None)
        .returning(TeamQuestion.id)
    )
    row = db.execute(stmt).first()
    db.commit()
    if row is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "not currently claimed by you")
    broadcast_from_sync(
        user.team_id,
        {
            "type": "question_released",
            "team_question_id": str(team_question_id),
            "user_id": str(user.id),
        },
    )
    return {"status": "released"}


@router.post("/{team_question_id}/answer", response_model=AnswerOut)
def answer_question(
    team_question_id: uuid.UUID,
    payload: AnswerIn,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    tq = _get_owned_team_question(db, team_question_id, user.team_id)

    if tq.status != TeamQuestionStatus.claimed or tq.assigned_to != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "you have not claimed this question")

    question = db.get(Question, tq.question_id)
    correct = payload.selected_answer == question.correct_answer

    db.add(
        Attempt(
            team_question_id=tq.id,
            user_id=user.id,
            selected_answer=payload.selected_answer,
            correct=correct,
        )
    )

    if question.round == 2:
        now = datetime.now(timezone.utc)
        db.execute(
            update(TeamQuestion)
            .where(TeamQuestion.id == team_question_id, TeamQuestion.status == TeamQuestionStatus.claimed)
            .values(
                status=TeamQuestionStatus.solved,
                solved_by=user.id,
                solved_at=now,
                judge_approved=None,
                judge_reviewed_by=None,
                judge_reviewed_at=None,
            )
        )
        db.commit()
        broadcast_from_sync(user.team_id, {"type": "round_progress_updated", "round": 2})
        return AnswerOut(correct=True, message="Submitted for judge review")

    if not correct:
        db.commit()
        return AnswerOut(correct=False, message="Incorrect — Try Again")

    now = datetime.now(timezone.utc)
    stmt = (
        update(TeamQuestion)
        .where(
            TeamQuestion.id == team_question_id,
            TeamQuestion.team_id == user.team_id,
            TeamQuestion.status == TeamQuestionStatus.claimed,
        )
        .values(status=TeamQuestionStatus.solved, solved_by=user.id, solved_at=now)
        .returning(TeamQuestion.id)
    )
    row = db.execute(stmt).first()
    db.commit()
    if row is None:
        # claim expired/changed between the check above and this write
        raise HTTPException(status.HTTP_409_CONFLICT, "claim expired before answer was recorded")

    broadcast_from_sync(
        user.team_id,
        {
            "type": "question_solved",
            "team_question_id": str(team_question_id),
            "code_fragment": question.code_fragment if question.round == 1 else None,
            "solved_by": user.name,
        },
    )

    solved_count, total_count = db.execute(
        select(
            func.count().filter(TeamQuestion.status == TeamQuestionStatus.solved),
            func.count(),
        )
        .select_from(TeamQuestion)
        .join(Question, Question.id == TeamQuestion.question_id)
        .where(TeamQuestion.team_id == user.team_id, Question.round == question.round)
    ).one()
    broadcast_from_sync(
        user.team_id,
        {
            "type": "round_progress_updated",
            "round": question.round,
            "solved": solved_count,
            "total": total_count,
        },
    )

    # Cheapest correct way to catch the round-unlock transition: just check
    # post-solve state and fire whenever it's True. A redundant
    # round_unlocked on an already-unlocked round is harmless for clients.
    team = db.get(Team, user.team_id)
    if is_round_unlocked(db, team, question.round + 1):
        broadcast_from_sync(
            user.team_id, {"type": "round_unlocked", "round": question.round + 1}
        )

    return AnswerOut(correct=True, message="Correct", code_fragment=question.code_fragment)
