"""Per-team phrase keys and scrambled anagrams."""

import hashlib
import random

from sqlalchemy.orm import Session

from app.models import Team
from app.models.enums import TeamQuestionStatus
from app.services.key_phrases import phrase_for_round


def _rng(team_code: str, round_number: int) -> random.Random:
    seed = hashlib.sha256(f"{team_code}:{round_number}".encode()).hexdigest()
    return random.Random(int(seed, 16))


def _letters(phrase: str) -> str:
    return phrase.replace(" ", "").upper()


def word_lengths(phrase: str) -> list[int]:
    return [len(word) for word in phrase.split()]


def scramble_key(plaintext: str, team_code: str, round_number: int) -> str:
    """Shuffle phrase letters and hide word boundaries."""
    original = list(_letters(plaintext))
    chars = list(original)
    rng = _rng(team_code, round_number)
    for _ in range(50):
        rng.shuffle(chars)
        if chars != original:
            break
    return "".join(chars)


def fragments_for_phrase(phrase: str, team_code: str, count: int) -> list[str]:
    """Partition shuffled phrase letters without exposing answer order."""
    if count <= 0:
        return []
    seed = hashlib.sha256(f"{team_code}:fragments:{phrase}".encode()).hexdigest()
    letters = list(_letters(phrase))
    random.Random(int(seed, 16)).shuffle(letters)
    base, extra = divmod(len(letters), count)
    fragments: list[str] = []
    index = 0
    for position in range(count):
        size = base + (position < extra)
        fragments.append("".join(letters[index : index + size]))
        index += size
    return fragments


def keys_match(submitted: str, plaintext: str) -> bool:
    return _letters(submitted.strip()) == _letters(plaintext.strip())


def plaintext_key(db: Session, team: Team, round_number: int) -> str | None:
    """Return phrase only after every question is solved."""
    from app.services.question_gen import assign_round_for

    team_questions = assign_round_for(db, team, round_number)
    if not team_questions or any(tq.status != TeamQuestionStatus.solved for tq in team_questions):
        return None
    phrase, _hint = phrase_for_round(team.team_code, round_number)
    return phrase


def key_hint(team_code: str, round_number: int) -> str:
    _phrase, hint = phrase_for_round(team_code, round_number)
    return hint
