import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterTeamIn


def registration_payload(member_count: int) -> dict:
    return {
        "team_name": "Modular Team",
        "team_password": "shared-pass",
        "members": [
            {"name": f"Member {index}", "email": f"member{index}@example.com"}
            for index in range(1, member_count + 1)
        ],
    }


@pytest.mark.parametrize("member_count", [1, 2, 3, 4])
def test_registration_accepts_one_to_four_members(member_count: int):
    registration = RegisterTeamIn.model_validate(registration_payload(member_count))

    assert len(registration.members) == member_count


@pytest.mark.parametrize("member_count", [0, 5])
def test_registration_rejects_team_sizes_outside_one_to_four(member_count: int):
    with pytest.raises(ValidationError):
        RegisterTeamIn.model_validate(registration_payload(member_count))
