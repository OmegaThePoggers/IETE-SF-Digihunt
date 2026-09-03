from pydantic import BaseModel, Field


class GateStatusOut(BaseModel):
    round_number: int          # the round this gate unlocks
    source_round: int          # the round whose key must be unscrambled
    ready: bool                # source round fully solved
    unlocked: bool             # already solved
    scrambled_key: str | None  # shown only when ready and not yet unlocked
    hint: str | None = None
    word_lengths: list[int] = Field(default_factory=list)
    attempts: int


class GateUnlockIn(BaseModel):
    key: str


class GateUnlockOut(BaseModel):
    correct: bool
    message: str
    unlocked: bool
