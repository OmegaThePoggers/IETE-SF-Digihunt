"""Admin dashboard: live event stats, team inspection, event settings,
and dev/operational test controls (spec §46-48).

Every route requires role=admin (Depends(require_role("admin"))).

The `/admin/dev/*` routes are explicitly operational/test tooling for admins
running the event (reset a team's progress, force-unlock a round, reassign a
case, etc.) — not hidden debug backdoors, hence living in this same router
with the same admin-only guard rather than a separate "secret" module.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_role
from app.models import (
    Attempt,
    CaseFile,
    EventSettings,
    Question,
    RoundUnlock,
    Score,
    Submission,
    Team,
    TeamCase,
    TeamQuestion,
    User,
)
from app.models.enums import TeamQuestionStatus, TeamStatus
from app.schemas.admin import (
    AdminRoundProgress,
    AdminSubmissionListItem,
    AdminTeamListItem,
    DashboardOut,
    SettingIn,
    SettingOut,
)
from app.services.case_gen import SEED_CASES, seed_cases
from app.services.round_gate import ROUND_COUNT, requires_gate

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))]
)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    registered_teams = db.scalar(select(func.count()).select_from(Team))
    active_teams = db.scalar(
        select(func.count()).select_from(Team).where(Team.status == TeamStatus.active)
    )

    # round{N}_count definition: number of *distinct teams* with >=1 solved
    # question in that round (not "round complete" — that's what the team
    # dashboard's round-progress bars already show per-team; this is a coarse
    # "how many teams have touched this round" event-health signal).
    def _round_touched_count(round_num: int) -> int:
        return db.scalar(
            select(func.count(func.distinct(TeamQuestion.team_id)))
            .select_from(TeamQuestion)
            .join(Question, Question.id == TeamQuestion.question_id)
            .where(
                Question.round == round_num,
                TeamQuestion.status == TeamQuestionStatus.solved,
            )
        )

    submitted_count = db.scalar(
        select(func.count(func.distinct(Submission.team_id))).where(
            Submission.is_current.is_(True)
        )
    )

    return DashboardOut(
        registered_teams=registered_teams,
        active_teams=active_teams,
        round1_count=_round_touched_count(1),
        round2_count=_round_touched_count(2),
        round3_count=_round_touched_count(3),
        submitted_count=submitted_count,
    )


@router.get("/teams", response_model=list[AdminTeamListItem])
def list_teams(db: Session = Depends(get_db)):
    teams = db.scalars(select(Team).order_by(Team.created_at)).all()

    member_counts = dict(
        db.execute(
            select(User.team_id, func.count())
            .where(User.team_id.is_not(None))
            .group_by(User.team_id)
        ).all()
    )

    # one aggregate query for round1+round2+round3 solved/total per team, batched
    # instead of a query per team per round.
    progress_rows = db.execute(
        select(
            TeamQuestion.team_id,
            Question.round,
            func.count(),
            func.count().filter(TeamQuestion.status == TeamQuestionStatus.solved),
        )
        .join(Question, Question.id == TeamQuestion.question_id)
        .where(Question.round.in_([1, 2, 3]))
        .group_by(TeamQuestion.team_id, Question.round)
    ).all()
    progress: dict[tuple[uuid.UUID, int], tuple[int, int]] = {
        (team_id, round_num): (solved, total)
        for team_id, round_num, total, solved in progress_rows
    }

    case_titles = dict(
        db.execute(
            select(TeamCase.team_id, CaseFile.title).join(
                CaseFile, CaseFile.id == TeamCase.case_id
            )
        ).all()
    )

    submitted_team_ids = set(
        db.scalars(
            select(Submission.team_id).where(Submission.is_current.is_(True))
        ).all()
    )

    items = []
    for team in teams:
        r1_solved, r1_total = progress.get((team.id, 1), (0, 0))
        r2_solved, r2_total = progress.get((team.id, 2), (0, 0))
        r3_solved, r3_total = progress.get((team.id, 3), (0, 0))
        items.append(
            AdminTeamListItem(
                id=team.id,
                team_code=team.team_code,
                team_name=team.team_name,
                status=team.status.value,
                member_count=member_counts.get(team.id, 0),
                round1=AdminRoundProgress(solved=r1_solved, total=r1_total),
                round2=AdminRoundProgress(solved=r2_solved, total=r2_total),
                round3=AdminRoundProgress(solved=r3_solved, total=r3_total),
                round4_case=case_titles.get(team.id),
                submitted=team.id in submitted_team_ids,
            )
        )
    return items


@router.get("/teams/{team_id}")
def get_team_detail(team_id: uuid.UUID, db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "team not found")

    members = db.scalars(select(User).where(User.team_id == team_id)).all()
    name_by_user_id = {m.id: m.name for m in members}

    team_questions = db.scalars(
        select(TeamQuestion)
        .join(Question, Question.id == TeamQuestion.question_id)
        .where(TeamQuestion.team_id == team_id)
        .order_by(Question.round, Question.category)
    ).all()

    wrong_counts = dict(
        db.execute(
            select(Attempt.team_question_id, func.count())
            .where(
                Attempt.team_question_id.in_([tq.id for tq in team_questions]),
                Attempt.correct.is_(False),
            )
            .group_by(Attempt.team_question_id)
        ).all()
    ) if team_questions else {}

    questions_out = []
    round2_summary: dict[str, str] = {}
    round2_all_solved = True
    round2_seen = False
    for tq in team_questions:
        q = tq.question
        solved = tq.status == TeamQuestionStatus.solved
        questions_out.append(
            {
                "team_question_id": tq.id,
                "round": q.round,
                "category": q.category,
                "question_text": q.question_text,
                "status": tq.status.value,
                "solved_by": name_by_user_id.get(tq.solved_by),
                "solved_at": tq.solved_at,
                "wrong_attempt_count": wrong_counts.get(tq.id, 0),
            }
        )
        if q.round == 2:
            round2_seen = True
            if solved:
                round2_summary[q.category] = q.correct_answer
            else:
                round2_all_solved = False

    team_case = db.scalar(select(TeamCase).where(TeamCase.team_id == team_id))
    case_out = None
    if team_case is not None:
        case_file = db.get(CaseFile, team_case.case_id)
        case_out = {
            "case_number": case_file.case_number,
            "title": case_file.title,
            "assigned_at": team_case.assigned_at,
        }

    submissions = db.scalars(
        select(Submission).where(Submission.team_id == team_id).order_by(Submission.version)
    ).all()
    submission_history = [
        {
            "version": s.version,
            "file_name": s.file_name,
            "uploaded_by": name_by_user_id.get(s.uploaded_by),
            "submitted_at": s.submitted_at,
            "is_current": s.is_current,
            "submission_id": s.id,
        }
        for s in submissions
    ]

    scores = db.scalars(select(Score).where(Score.team_id == team_id)).all()
    scores_out = [
        {
            "judge_id": sc.judge_id,
            "problem_understanding": sc.problem_understanding,
            "technical_solution": sc.technical_solution,
            "creativity": sc.creativity,
            "presentation": sc.presentation,
            "feasibility": sc.feasibility,
            "total": sc.total,
            "comments": sc.comments,
            "finalized": sc.finalized,
            "finalized_at": sc.finalized_at,
        }
        for sc in scores
    ]

    return {
        "id": team.id,
        "team_code": team.team_code,
        "team_name": team.team_name,
        "status": team.status.value,
        "members": [
            {"id": m.id, "name": m.name, "email": m.email, "last_login": m.last_login}
            for m in members
        ],
        "questions": questions_out,
        "round2_investigation_summary": round2_summary if (round2_seen and round2_all_solved) else None,
        "case": case_out,
        "submission_history": submission_history,
        "scores": scores_out,
    }


@router.get("/submissions", response_model=list[AdminSubmissionListItem])
def list_submissions(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Submission, Team.team_code)
        .join(Team, Team.id == Submission.team_id)
        .where(Submission.is_current.is_(True))
        .order_by(Team.team_code)
    ).all()
    return [
        AdminSubmissionListItem(
            team_code=team_code,
            file_name=s.file_name,
            version=s.version,
            submitted_at=s.submitted_at,
            submission_id=s.id,
        )
        for s, team_code in rows
    ]


@router.get("/submissions/{submission_id}/download")
def admin_download_submission(submission_id: uuid.UUID, db: Session = Depends(get_db)):
    # Deliberately no team-ownership check here (unlike the participant-scoped
    # GET /submissions/{id}/download) — admin can download any team's file.
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    return FileResponse(
        submission.file_path,
        filename=submission.file_name,
        media_type=submission.mime_type,
    )


# ---- Event settings --------------------------------------------------------
# Keys the rest of the app actually reads:
#   - "round4_deadline": JSON-encoded ISO datetime string, read by
#     submissions.py to gate uploads after a deadline.
#   - "question_claim_timeout_minutes": plain int-as-string, read by
#     questions.py's claim endpoint (falls back to 5 if missing/invalid).


@router.get("/settings", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db)):
    rows = db.scalars(select(EventSettings)).all()
    return [SettingOut(key=r.key, value=r.value, updated_at=r.updated_at) for r in rows]


@router.put("/settings/{key}", response_model=SettingOut)
def upsert_setting(key: str, payload: SettingIn, db: Session = Depends(get_db)):
    row = db.get(EventSettings, key)
    if row is None:
        row = EventSettings(key=key, value=payload.value)
        db.add(row)
    else:
        row.value = payload.value
        row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return SettingOut(key=row.key, value=row.value, updated_at=row.updated_at)


# ---- Dev / admin operational test controls (spec §47) ----------------------
# These are admin-facing operational tools for running the event (reset a
# stuck team, give another shot at a question, demo a specific case/round
# without re-registering teams) — not hidden debug magic.


@router.post("/dev/reset-team/{team_id}")
def reset_team(team_id: uuid.UUID, db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "team not found")

    tq_ids = db.scalars(
        select(TeamQuestion.id).where(TeamQuestion.team_id == team_id)
    ).all()
    if tq_ids:
        db.execute(Attempt.__table__.delete().where(Attempt.team_question_id.in_(tq_ids)))
    db.execute(TeamQuestion.__table__.delete().where(TeamQuestion.team_id == team_id))
    db.execute(TeamCase.__table__.delete().where(TeamCase.team_id == team_id))
    db.execute(Submission.__table__.delete().where(Submission.team_id == team_id))
    db.commit()
    return {"status": "reset", "team_id": team_id}


@router.post("/dev/reset-question/{team_question_id}")
def reset_question(team_question_id: uuid.UUID, db: Session = Depends(get_db)):
    tq = db.get(TeamQuestion, team_question_id)
    if tq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "team question not found")
    tq.status = TeamQuestionStatus.available
    tq.assigned_to = None
    tq.claim_expires_at = None
    tq.solved_by = None
    tq.solved_at = None
    db.commit()
    return {"status": "reset", "team_question_id": team_question_id}


@router.post("/dev/unlock-round/{team_id}/{round_number}")
def unlock_round(team_id: uuid.UUID, round_number: int, db: Session = Depends(get_db)):
    """Override unlock by inserting the same RoundUnlock row a correct
    cipher-gate submission would create — the real gate (is_round_unlocked)
    reads exactly this table, so there is no parallel override flag that
    could later contradict the computed state."""
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "team not found")

    if not requires_gate(round_number) or not (2 <= round_number <= ROUND_COUNT):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"round_number must be between 2 and {ROUND_COUNT} to unlock",
        )

    existing = db.scalar(
        select(RoundUnlock.id).where(
            RoundUnlock.team_id == team_id, RoundUnlock.round_number == round_number
        )
    )
    if existing is None:
        db.add(RoundUnlock(team_id=team_id, round_number=round_number))
    db.commit()
    return {"status": "unlocked", "team_id": team_id, "round_number": round_number}


@router.post("/dev/assign-case/{team_id}/{case_number}")
def assign_case_override(team_id: uuid.UUID, case_number: int, db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "team not found")

    case_file = db.scalar(select(CaseFile).where(CaseFile.case_number == case_number))
    if case_file is None and db.scalar(select(CaseFile.id)) is None:
        # lazy self-seed on first use, same pattern as case_gen.assign_case,
        # so this endpoint works even before any team has hit GET /cases/me.
        seed_cases(db)
        case_file = db.scalar(select(CaseFile).where(CaseFile.case_number == case_number))
    if case_file is None:
        valid = {c["case_number"] for c in SEED_CASES}
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"no case_file with case_number={case_number} (valid: {valid})"
        )

    team_case = db.scalar(select(TeamCase).where(TeamCase.team_id == team_id))
    if team_case is None:
        db.add(TeamCase(team_id=team_id, case_id=case_file.id))
    else:
        team_case.case_id = case_file.id
    db.commit()
    return {"status": "assigned", "team_id": team_id, "case_number": case_number}
