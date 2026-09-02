import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


class MemberIn(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr


class RegisterTeamIn(BaseModel):
    team_name: str = Field(min_length=1)
    team_password: str = Field(min_length=8)
    members: list[MemberIn] = Field(min_length=1, max_length=4)

    @field_validator("members")
    @classmethod
    def emails_unique(cls, members: list[MemberIn]) -> list[MemberIn]:
        emails = [m.email.lower() for m in members]
        if len(set(emails)) != len(emails):
            raise ValueError("member emails must be unique")
        return members


class MemberOut(BaseModel):
    name: str
    email: EmailStr


class RegisterTeamOut(BaseModel):
    team_code: str
    team_name: str
    members: list[MemberOut]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    team_code: str | None = None


class MeOut(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    team_id: uuid.UUID | None
    team_code: str | None = None
