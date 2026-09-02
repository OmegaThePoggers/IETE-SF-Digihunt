import uuid
from datetime import datetime

from pydantic import BaseModel


class DashboardOut(BaseModel):
    registered_teams: int
    active_teams: int
    round1_count: int
    round2_count: int
    round3_count: int
    submitted_count: int  # teams with a current Round 4 submission


class AdminRoundProgress(BaseModel):
    solved: int
    total: int


class AdminTeamListItem(BaseModel):
    id: uuid.UUID
    team_code: str
    team_name: str
    status: str
    member_count: int
    round1: AdminRoundProgress
    round2: AdminRoundProgress
    round3: AdminRoundProgress
    round4_case: str | None
    submitted: bool


class SettingOut(BaseModel):
    key: str
    value: str
    updated_at: datetime


class SettingIn(BaseModel):
    value: str


class MasterCodeIn(BaseModel):
    code: str


class MasterCodeStatusOut(BaseModel):
    is_set: bool


class AdminSubmissionListItem(BaseModel):
    team_code: str
    file_name: str
    version: int
    submitted_at: datetime
    submission_id: uuid.UUID
