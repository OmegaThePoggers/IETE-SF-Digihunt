"""Per-team round keys and their anagram form.

Finishing a round yields a plaintext key built from that round's solved
code fragments. The team is shown a scrambled version of it; unscrambling
that anagram is what unlocks the next round. Derivation is deterministic
(seeded on team_code + round), so no key material is ever stored as a
secret and any process can recompute the same values.
"""

import hashlib
import random

from sqlalchemy.orm import Session

from app.models import Team
from app.models.enums import TeamQuestionStatus

KEY_PREFIX = "DIGI"


def _rng(team_code: str, round_number: int) -> random.Random:
    seed = hashlib.sha256(f"{team_code}:{round_number}".encode()).hexdigest()
    return random.Random(int(seed, 16))


def scramble_key(plaintext: str, team_code: str, round_number: int) -> str:
    """Shuffle every non-prefix character across the whole key (not just
    within its own block), then re-split back into the original block
    lengths. Shuffling globally rather than per-block gives enough
    permutation space that short (even 2-character) blocks still scramble
    differently per team/round instead of collapsing onto the single
    non-identity swap."""
    rng = _rng(team_code, round_number)
    blocks = plaintext.split("-")
    has_prefix = bool(blocks) and blocks[0] == KEY_PREFIX
    prefix = [KEY_PREFIX] if has_prefix else []
    rest_blocks = blocks[1:] if has_prefix else blocks
    lengths = [len(b) for b in rest_blocks]

    original_chars = list("".join(rest_blocks))
    chars = list(original_chars)
    for _ in range(50):
        rng.shuffle(chars)
        if chars != original_chars:
            break

    out_blocks: list[str] = []
    idx = 0
    for length in lengths:
        out_blocks.append("".join(chars[idx : idx + length]))
        idx += length

    scrambled = "-".join(prefix + out_blocks)
    if scrambled == plaintext:
        # Every character shuffle round-tripped to the original order (only
        # possible for degenerate 0/1-character keys): fall back to
        # reversing the block order after the prefix so the displayed key
        # still differs from the answer.
        tail = rest_blocks[::-1]
        scrambled = "-".join(prefix + tail)
    return scrambled


def keys_match(submitted: str, plaintext: str) -> bool:
    return submitted.strip().upper() == plaintext.strip().upper()


def plaintext_key(db: Session, team: Team, round_number: int) -> str | None:
    """None until every TeamQuestion in the round is solved."""
    from app.services.question_gen import assign_round_for

    team_questions = assign_round_for(db, team, round_number)
    if not team_questions:
        return None

    fragments: list[str] = []
    for tq in team_questions:
        if tq.status != TeamQuestionStatus.solved:
            return None
        fragments.append(tq.question.code_fragment or "")
    return "-".join([KEY_PREFIX, *fragments])
