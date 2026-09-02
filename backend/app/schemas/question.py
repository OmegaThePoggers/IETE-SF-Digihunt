import uuid

from pydantic import BaseModel


class QuestionBoardItem(BaseModel):
    team_question_id: uuid.UUID
    category: str
    difficulty: str
    question_text: str
    options: list[str] | None
    status: str
    claimed_by_name: str | None = None
    code_fragment: str | None = None  # only populated once status == "solved"
    judge_approved: bool | None = None


class RoundBoardOut(BaseModel):
    questions: list[QuestionBoardItem]
    all_complete: bool
    # Every MCQ round now ends in a cipher gate rather than displaying its
    # key inline; the key itself is served by GET /gates/{next_gate_round}.
    next_gate_round: int | None = None
    investigation_complete: bool = False  # Round 2 only
    summary: dict[str, str] | None = None  # Round 2 only: who/what/when/how/why
    awaiting_judge_approval: bool = False


class AnswerIn(BaseModel):
    selected_answer: str


class AnswerOut(BaseModel):
    correct: bool
    message: str
    code_fragment: str | None = None
