"""Judge-facing scoring routes (spec phase 17/34).

"Assigned teams" (spec §34) = every team with a current submission — there is
no per-judge team-assignment table in the schema, so every judge account sees
every submitted team (see PLAN.md G9 note). Scores are still strictly scoped
per-judge: each judge has at most one Score row per team, and never sees or
overwrites another judge's row.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_role
from app.models import Attempt, CaseFile, Question, Score, Submission, Team, TeamCase, TeamQuestion, User
from app.models.enums import TeamQuestionStatus
from app.schemas.judging import (
    AssignedCaseOut,
    AssignedSubmissionOut,
    AssignedTeamOut,
    MyScoreSummary,
    Round2ReviewOut,
    ScoreIn,
    ScoreOut,
    TeamJudgingDetailOut,
)
from app.services.round_gate import round_fully_solved

router = APIRouter(
    prefix="/judging", tags=["judging"], dependencies=[Depends(require_role("judge"))]
)


def _get_current_submission(db: Session, team_id: uuid.UUID) -> Submission | None:
    return db.scalar(
        select(Submission).where(
            Submission.team_id == team_id, Submission.is_current.is_(True)
        )
    )


def _get_case(db: Session, team_id: uuid.UUID) -> AssignedCaseOut | None:
    team_case = db.scalar(select(TeamCase).where(TeamCase.team_id == team_id))
    if team_case is None:
        return None
    case_file = db.get(CaseFile, team_case.case_id)
    return AssignedCaseOut(title=case_file.title, case_number=case_file.case_number)


@router.get("/assigned", response_model=list[AssignedTeamOut])
def list_assigned_teams(
    judge: User = Depends(require_role("judge")), db: Session = Depends(get_db)
):
    teams = db.scalars(select(Team).order_by(Team.team_code)).all()

    my_scores = {
        s.team_id: s
        for s in db.scalars(select(Score).where(Score.judge_id == judge.id)).all()
    }

    out = []
    for team in teams:
        submission = _get_current_submission(db, team.id)
        my_score = my_scores.get(team.id)
        out.append(
            AssignedTeamOut(
                team_id=team.id,
                team_code=team.team_code,
                case=_get_case(db, team.id),
                submission=(
                    AssignedSubmissionOut(
                        id=submission.id,
                        file_name=submission.file_name,
                        submitted_at=submission.submitted_at,
                    )
                    if submission
                    else None
                ),
                my_score=MyScoreSummary(total=my_score.total, finalized=my_score.finalized)
                if my_score is not None
                else None,
                round1_complete=round_fully_solved(db, team.id, 1),
                round2_complete=round_fully_solved(db, team.id, 2),
                round3_complete=round_fully_solved(db, team.id, 3),
                round4_submitted=submission is not None,
            )
        )
    return out


@router.get("/teams/{team_id}", response_model=TeamJudgingDetailOut)
def get_team_judging_detail(
    team_id: uuid.UUID,
    judge: User = Depends(require_role("judge")),
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")

    submission = _get_current_submission(db, team_id)
    # Round 2 investigation summary — same shape as admin.py's get_team_detail,
    # only populated once every round-2 question is solved.
    round2_rows = db.scalars(
        select(TeamQuestion)
        .join(Question, Question.id == TeamQuestion.question_id)
        .where(TeamQuestion.team_id == team_id, Question.round == 2)
    ).all()
    round2_summary: dict[str, str] | None = None
    attempts = db.scalars(
        select(Attempt).where(Attempt.team_question_id.in_([row.id for row in round2_rows])).order_by(Attempt.created_at.desc())
    ).all() if round2_rows else []
    latest_attempt = {}
    for attempt in attempts:
        latest_attempt.setdefault(attempt.team_question_id, attempt)
    round2_review = [
        Round2ReviewOut(
            team_question_id=row.id,
            category=row.question.category,
            question_text=row.question.question_text,
            submitted_answer=latest_attempt.get(row.id).selected_answer if row.id in latest_attempt else None,
            ideal_answer=row.question.correct_answer,
            judge_approved=row.judge_approved,
        )
        for row in round2_rows
    ]
    if round2_rows:
        all_solved = all(tq.status == TeamQuestionStatus.solved for tq in round2_rows)
        if all_solved:
            round2_summary = {
                tq.question.category: tq.question.correct_answer for tq in round2_rows
            }

    my_score_row = db.scalar(
        select(Score).where(Score.team_id == team_id, Score.judge_id == judge.id)
    )
    my_score = (
        ScoreOut(
            problem_understanding=my_score_row.problem_understanding,
            technical_solution=my_score_row.technical_solution,
            creativity=my_score_row.creativity,
            presentation=my_score_row.presentation,
            feasibility=my_score_row.feasibility,
            total=my_score_row.total,
            comments=my_score_row.comments,
            finalized=my_score_row.finalized,
            finalized_at=my_score_row.finalized_at,
        )
        if my_score_row is not None
        else None
    )

    return TeamJudgingDetailOut(
        team_id=team.id,
        team_code=team.team_code,
        case=_get_case(db, team_id),
        submission=AssignedSubmissionOut(
            id=submission.id, file_name=submission.file_name, submitted_at=submission.submitted_at
        ) if submission else None,
        round2_investigation_summary=round2_summary,
        my_score=my_score,
        round2_review=round2_review,
    )


@router.get("/teams/{team_id}/download")
def download_team_submission(
    team_id: uuid.UUID, db: Session = Depends(get_db)
):
    # SECURITY: id->path lookup is entirely server-side, same pattern as
    # admin/participant download routes — never accept a client-supplied path.
    submission = _get_current_submission(db, team_id)
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team has no current submission")
    return FileResponse(
        submission.file_path,
        filename=submission.file_name,
        media_type=submission.mime_type,
    )


@router.post("/teams/{team_id}/score", response_model=ScoreOut)
def submit_score(
    team_id: uuid.UUID,
    payload: ScoreIn,
    judge: User = Depends(require_role("judge")),
    db: Session = Depends(get_db),
):
    if _get_current_submission(db, team_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team has no current submission")

    total = (
        payload.problem_understanding
        + payload.technical_solution
        + payload.creativity
        + payload.presentation
        + payload.feasibility
    )

    score = db.scalar(
        select(Score).where(Score.team_id == team_id, Score.judge_id == judge.id)
    )

    # Finalized is a one-way door: once set, no further edits are accepted at
    # all (even a request that merely repeats finalize=True), so a judge can't
    # accidentally overwrite a submitted score. 409 = the resource is in a
    # state that conflicts with this write.
    if score is not None and score.finalized:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Score already finalized — cannot be edited"
        )

    now = datetime.now(timezone.utc)
    if score is None:
        score = Score(team_id=team_id, judge_id=judge.id)
        db.add(score)

    score.problem_understanding = payload.problem_understanding
    score.technical_solution = payload.technical_solution
    score.creativity = payload.creativity
    score.presentation = payload.presentation
    score.feasibility = payload.feasibility
    score.total = total
    score.comments = payload.comments
    if payload.finalize:
        score.finalized = True
        score.finalized_at = now

    db.commit()
    db.refresh(score)

    return ScoreOut(
        problem_understanding=score.problem_understanding,
        technical_solution=score.technical_solution,
        creativity=score.creativity,
        presentation=score.presentation,
        feasibility=score.feasibility,
        total=score.total,
        comments=score.comments,
        finalized=score.finalized,
        finalized_at=score.finalized_at,
    )
