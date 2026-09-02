import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AssignedCaseOut(BaseModel):
    title: str
    case_number: int


class AssignedSubmissionOut(BaseModel):
    id: uuid.UUID
    file_name: str
    submitted_at: datetime


class Round2ReviewOut(BaseModel):
    team_question_id: uuid.UUID
    category: str
    question_text: str
    submitted_answer: str | None
    ideal_answer: str
    # Round 2 is an auto-checked MCQ round. Judges see this as read-only context.
    judge_approved: bool | None


class MyScoreSummary(BaseModel):
    total: int
    finalized: bool


class AssignedTeamOut(BaseModel):
    team_id: uuid.UUID
    team_code: str
    case: AssignedCaseOut | None
    submission: AssignedSubmissionOut | None
    my_score: MyScoreSummary | None
    round1_complete: bool
    round2_complete: bool
    round3_complete: bool
    round4_submitted: bool


class ScoreOut(BaseModel):
    problem_understanding: int
    technical_solution: int
    creativity: int
    presentation: int
    feasibility: int
    total: int
    comments: str | None
    finalized: bool
    finalized_at: datetime | None


class TeamJudgingDetailOut(BaseModel):
    team_id: uuid.UUID
    team_code: str
    case: AssignedCaseOut | None
    submission: AssignedSubmissionOut | None
    # nice-to-have, only populated once round 2 is fully solved (mirrors
    # admin.py's get_team_detail round2_investigation_summary logic) — None
    # otherwise, never an awkward partial summary.
    round2_investigation_summary: dict[str, str] | None
    my_score: ScoreOut | None
    round2_review: list[Round2ReviewOut]


class ScoreIn(BaseModel):
    # total is never accepted from the client — always computed server-side
    # as the sum of the five sub-scores below.
    problem_understanding: int = Field(ge=0, le=10)
    technical_solution: int = Field(ge=0, le=20)
    creativity: int = Field(ge=0, le=10)
    presentation: int = Field(ge=0, le=10)
    feasibility: int = Field(ge=0, le=10)
    comments: str | None = None
    finalize: bool = False
