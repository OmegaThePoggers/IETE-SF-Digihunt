from pydantic import BaseModel


class GateStatusOut(BaseModel):
    round_number: int          # the round this gate unlocks
    source_round: int          # the round whose key must be unscrambled
    ready: bool                # source round fully solved
    unlocked: bool             # already solved
    scrambled_key: str | None  # shown only when ready and not yet unlocked
    attempts: int


class GateUnlockIn(BaseModel):
    key: str


class GateUnlockOut(BaseModel):
    correct: bool
    message: str
    unlocked: bool
