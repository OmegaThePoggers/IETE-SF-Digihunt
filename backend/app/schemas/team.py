import uuid

from pydantic import BaseModel


class MemberOut(BaseModel):
    id: uuid.UUID
    name: str
    is_you: bool


class RoundProgress(BaseModel):
    solved: int
    total: int
    locked: bool


class GateProgress(BaseModel):
    round_number: int
    ready: bool
    unlocked: bool


class RoundsOut(BaseModel):
    round1: RoundProgress
    round2: RoundProgress
    round3: RoundProgress
    round4: RoundProgress
    gates: list[GateProgress]


class TeamMeOut(BaseModel):
    team_code: str
    team_name: str
    members: list[MemberOut]
    rounds: RoundsOut
