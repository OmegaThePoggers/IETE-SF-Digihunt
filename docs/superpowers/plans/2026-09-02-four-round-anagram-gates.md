# Four Rounds + Anagram Key Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn DigiHunt into four rounds (R1 MCQ → R2 MCQ → R3 MCQ → R4 PPT upload) where finishing a round yields a per-team scrambled key that the team must unscramble to unlock the next round, replacing the one-off Master Terminal.

**Architecture:** Round content stays exactly as it works today (deterministic per-team question generation, claim/answer flow, auto-checked MCQs). Two things change. First, the PPT-upload round moves from round 3 to round 4 and a new MCQ round 3 is added, sourced from Stage 3 of `digi hunt final 20qs.pdf`. Second, the unlock rule for every round after the first becomes a uniform "cipher gate": once round N is fully solved, the backend derives a deterministic per-team key from that round's code fragments, shows the team a scrambled anagram of it, and unlocking round N+1 requires submitting the correct unscrambled key. The Master Terminal collapses into this same gate mechanism so there is exactly one unlock concept in the system.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL (backend), Next.js 16 App Router + React 19 + Tailwind v4 + Vitest/Testing Library (frontend), Docker Compose for deployment.

---

## Behavioural contract (what must NOT change)

- Round boards keep the same claim / release / answer flow and the same "one member at a time per question" locking.
- MCQ answers stay auto-checked. Judges never approve MCQ rounds.
- Judge scoring applies to exactly one round: the PPT upload round (now round 4).
- Team registration, login, roles, presence, websocket events, and admin tooling keep their existing behaviour.
- Round 1 remains unlocked for everyone from the start.

## New model of progression

```
Round 1 (MCQ)  --solve all--> key K1 shown scrambled --unscramble--> Round 2 unlocked
Round 2 (MCQ)  --solve all--> key K2 shown scrambled --unscramble--> Round 3 unlocked
Round 3 (MCQ)  --solve all--> key K3 shown scrambled --unscramble--> Round 4 unlocked
Round 4 (PPT upload) --> judge scoring (unchanged)
```

Key derivation (deterministic, no new secrets):

- `plaintext_key(team, round)` = `"DIGI-" + "-".join(code_fragment of each solved TeamQuestion of that round, ordered by question_id)`.
- `scrambled_key(team, round)` = the same characters with each fragment's letters shuffled by a `random.Random` seeded on `sha256(team_code + ":" + round)`, re-rolled until it differs from the plaintext. Separator characters (`-`) and the `DIGI` prefix stay in place so the puzzle is "unscramble each block", not "guess the format".
- Comparison on submit is case-insensitive and whitespace-trimmed; the stored plaintext is the source of truth.

Because fragments come from the team-seeded question generator, every team gets a different key per round for free.

## File structure

Backend:

- `backend/app/models/round_key.py` (new): `RoundUnlock` rows recording a successful gate solve, plus `RoundKeyAttempt` rows for the audit/rate-limit trail.
- `backend/app/services/round_key.py` (new): key derivation, scrambling, verification. One responsibility: turn a (team, round) into `plaintext`, `scrambled`, and a `verify()` decision.
- `backend/app/services/round_gate.py` (modify): unlock rule becomes "a `RoundUnlock` row exists for this round".
- `backend/app/services/question_gen.py` (modify): add `ROUND3_BLUEPRINT` and the Stage 3 question banks; add `assign_round3`.
- `backend/app/routers/gates.py` (new): `GET /gates/{round}` and `POST /gates/{round}/unlock`.
- `backend/app/routers/questions.py` (modify): add the round 3 board, drop the round-1-only access-key special case in favour of the gate payload.
- `backend/app/routers/submissions.py` (modify): gate on round 4, rename the deadline setting.
- `backend/app/routers/teams.py`, `schemas/team.py` (modify): dashboard exposes four rounds plus gate state.
- `backend/app/routers/master.py` (delete) and `backend/app/services/master_gate.py` (delete): replaced by the uniform gate.
- `backend/app/routers/admin.py`, `backend/app/routers/judging.py`, `backend/app/seed.py` (modify): round renumbering and the new dev unlock path.
- `backend/alembic/versions/*_four_rounds_anagram_gates.py` (new): create the new tables, migrate `round3_deadline` → `round4_deadline`, and backfill `RoundUnlock` rows for teams that already passed the old Master Terminal so in-flight teams do not regress.

Frontend:

- `frontend/features/gate/gate-types.ts`, `gate-view.tsx`, `gate-fixtures.ts` (new): presentational cipher-gate screen, same fixture+view split the round features already use.
- `frontend/app/gate/[round]/page.tsx` (new): container that wires the API to `GateView`.
- `frontend/features/round3/*` and `frontend/app/round3/page.tsx` (new/replaced): round 3 becomes an MCQ board reusing the round 2 view shape.
- `frontend/app/round4/page.tsx` (new): the current `app/round3/page.tsx` upload UI, moved.
- `frontend/app/master/page.tsx` (delete), replaced by a redirect to the relevant gate.
- `frontend/features/dashboard/*`, `frontend/lib/api.ts`, `frontend/lib/dev-preview.ts`, `frontend/components/dev/preview-toolbar.tsx`, admin/judge pages (modify): four-round awareness.

---

## Task 1: Round key derivation service

**Files:**
- Create: `backend/app/services/round_key.py`
- Test: `backend/tests/test_round_key.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_round_key.py
from app.services.round_key import scramble_key, keys_match


def test_scramble_preserves_characters_and_layout():
    plain = "DIGI-AB-7Z-Q4"
    scrambled = scramble_key(plain, team_code="KH-2048", round_number=1)

    assert scrambled != plain
    assert scrambled.startswith("DIGI-")
    assert [len(b) for b in scrambled.split("-")] == [len(b) for b in plain.split("-")]
    assert sorted(scrambled.replace("-", "")) == sorted(plain.replace("-", ""))


def test_scramble_is_deterministic_per_team_and_round():
    a = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-2048", round_number=1)
    b = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-2048", round_number=1)
    c = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-2048", round_number=2)

    assert a == b
    assert a != c


def test_keys_match_is_case_and_whitespace_insensitive():
    assert keys_match("  digi-ab-7z-q4 ", "DIGI-AB-7Z-Q4")
    assert not keys_match("DIGI-AB-7Z-Q5", "DIGI-AB-7Z-Q4")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_round_key.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.round_key'`

- [ ] **Step 3: Write the implementation**

```python
# backend/app/services/round_key.py
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

from app.models import Team, TeamQuestion
from app.models.enums import TeamQuestionStatus

KEY_PREFIX = "DIGI"


def _rng(team_code: str, round_number: int) -> random.Random:
    seed = hashlib.sha256(f"{team_code}:{round_number}".encode()).hexdigest()
    return random.Random(int(seed, 16))


def scramble_key(plaintext: str, team_code: str, round_number: int) -> str:
    """Shuffle the characters inside each block, keeping the block layout
    and the leading KEY_PREFIX untouched so the puzzle is 'unscramble the
    blocks', not 'guess the format'."""
    rng = _rng(team_code, round_number)
    blocks = plaintext.split("-")

    out: list[str] = []
    for block in blocks:
        if block == KEY_PREFIX or len(block) < 2:
            out.append(block)
            continue
        chars = list(block)
        for _ in range(20):
            rng.shuffle(chars)
            if "".join(chars) != block:
                break
        out.append("".join(chars))

    scrambled = "-".join(out)
    if scrambled == plaintext:
        # Single-character blocks only: fall back to reversing block order
        # after the prefix so the displayed key still differs.
        tail = blocks[1:][::-1] if blocks and blocks[0] == KEY_PREFIX else blocks[::-1]
        head = [KEY_PREFIX] if blocks and blocks[0] == KEY_PREFIX else []
        scrambled = "-".join(head + tail)
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_round_key.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/round_key.py backend/tests/test_round_key.py
git commit -m "feat: add per-team round key anagram service"
```

---

## Task 2: Round 3 MCQ question bank

**Files:**
- Modify: `backend/app/services/question_gen.py`
- Test: `backend/tests/test_question_gen_round3.py`

Content source: Stage 3 of `digi hunt final 20qs.pdf` (access control, secure coding, monitoring/telemetry, incident response, cryptographic hygiene). Each PDF item becomes a four-option MCQ whose correct option is the PDF's expected answer.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_question_gen_round3.py
from app.services.question_gen import GENERATORS, ROUND3_BLUEPRINT


def test_round3_blueprint_covers_stage3_categories():
    categories = [c for c, _ in ROUND3_BLUEPRINT]
    assert categories == [
        "access_control",
        "secure_coding",
        "monitoring",
        "incident_response",
        "crypto_hygiene",
    ]
    assert sum(count for _, count in ROUND3_BLUEPRINT) == 6


def test_every_round3_category_has_a_generator_producing_four_options():
    import random

    for category, _ in ROUND3_BLUEPRINT:
        data = GENERATORS[category](random.Random(7))
        assert len(data["options"]) == 4
        assert data["correct_answer"] in data["options"]
        assert data["code_fragment"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_question_gen_round3.py -v`
Expected: FAIL with `ImportError: cannot import name 'ROUND3_BLUEPRINT'`

- [ ] **Step 3: Add the banks, blueprint, generators, and a generic assigner**

```python
# backend/app/services/question_gen.py  (append near the existing banks)

ROUND3_BLUEPRINT: list[tuple[str, int]] = [
    ("access_control", 2),
    ("secure_coding", 1),
    ("monitoring", 1),
    ("incident_response", 1),
    ("crypto_hygiene", 1),
]

ACCESS_CONTROL_BANK = [
    {
        "question_text": (
            "An access engine defines VIEWER, ANALYST and ADMIN roles. "
            "CONFIDENTIAL_REPORT is ADMIN-only. What is the correct outcome set?"
        ),
        "options": [
            "VIEWER denied, ANALYST denied, ADMIN granted",
            "VIEWER denied, ANALYST granted, ADMIN granted",
            "VIEWER granted, ANALYST granted, ADMIN granted",
            "VIEWER denied, ANALYST denied, ADMIN denied",
        ],
        "correct_answer": "VIEWER denied, ANALYST denied, ADMIN granted",
    },
    {
        "question_text": (
            "An unverified background process (PID 4412) tries to add VIEWER access "
            "to a restricted repository. What must the system do first?"
        ),
        "options": [
            "Quarantine the request, hold the original policy, raise a critical alert",
            "Apply the change and log it for later review",
            "Apply the change only for read operations",
            "Ignore the request silently",
        ],
        "correct_answer": "Quarantine the request, hold the original policy, raise a critical alert",
    },
]

SECURE_CODING_BANK = [
    {
        "question_text": "Which access check replaces the flawed `if role == 'ADMIN' or 'USER':`?",
        "options": [
            "return user_role in ALLOWED_ROLES",
            "return user_role == 'ADMIN' or 'USER'",
            "return bool(user_role)",
            "return user_role.lower() in str(ALLOWED_ROLES)",
        ],
        "correct_answer": "return user_role in ALLOWED_ROLES",
    },
    {
        "question_text": "Why is `if role == 'ADMIN' or 'USER':` always true in Python?",
        "options": [
            "A non-empty string literal is truthy, so the `or` short-circuits to True",
            "Python compares strings by identity",
            "`or` has higher precedence than `==`",
            "`role` is implicitly cast to bool before comparison",
        ],
        "correct_answer": "A non-empty string literal is truthy, so the `or` short-circuits to True",
    },
]

MONITORING_BANK = [
    {
        "question_text": "Which field set makes an intercepted policy-change alert actionable?",
        "options": [
            "Timestamp, Alert_ID, Severity, Actor, Target, Attempted_Action, Disposition",
            "Timestamp and message text only",
            "Severity and a free-text note",
            "Actor and target only",
        ],
        "correct_answer": "Timestamp, Alert_ID, Severity, Actor, Target, Attempted_Action, Disposition",
    },
    {
        "question_text": "Baseline policy is ADMIN ONLY; an unverified service tries to set ADMIN + ANALYST. What are the two required actions?",
        "options": [
            "Block the change and preserve the full event context for the alert queue",
            "Apply the change and email an administrator",
            "Apply the change and schedule a nightly audit",
            "Block the change and discard the event details",
        ],
        "correct_answer": "Block the change and preserve the full event context for the alert queue",
    },
]

INCIDENT_RESPONSE_BANK = [
    {
        "question_text": (
            "An email's display name is admin@company.com but the envelope sender is "
            "mailer@external-relays.ru, with execute.vbs inside a zip. How is it classified?"
        ),
        "options": [
            "Phishing: envelope/header mismatch plus an executable script payload",
            "Legitimate: the display name matches a known domain",
            "Spam: unwanted but harmless bulk mail",
            "Unknown: not enough signal to classify",
        ],
        "correct_answer": "Phishing: envelope/header mismatch plus an executable script payload",
    },
    {
        "question_text": "How should the app throttle brute-force attempts on the decryption passphrase?",
        "options": [
            "Exponential backoff or a 300-second lockout after 3 failures, with the actor logged",
            "Silently accept all attempts to avoid revealing the policy",
            "Permanently delete the account after one failure",
            "Slow the UI animation on each failed attempt",
        ],
        "correct_answer": "Exponential backoff or a 300-second lockout after 3 failures, with the actor logged",
    },
]

CRYPTO_HYGIENE_BANK = [
    {
        "question_text": "How is a tamper-evident audit log chained?",
        "options": [
            "hash = SHA256(previous_hash + timestamp + event_data + nonce)",
            "hash = SHA256(event_data) stored beside the row",
            "hash = MD5(timestamp) recomputed nightly",
            "The log is chained by auto-incrementing row IDs",
        ],
        "correct_answer": "hash = SHA256(previous_hash + timestamp + event_data + nonce)",
    },
    {
        "question_text": "What proves a decrypted file matches the original bitstream?",
        "options": [
            "SHA-256 of the original equals SHA-256 of the decrypted output",
            "The file sizes are the same",
            "The file opens without an error dialog",
            "The modified timestamps match",
        ],
        "correct_answer": "SHA-256 of the original equals SHA-256 of the decrypted output",
    },
]


def generate_access_control_question(rng: random.Random) -> dict:
    return _from_bank(rng, ACCESS_CONTROL_BANK)


def generate_secure_coding_question(rng: random.Random) -> dict:
    return _from_bank(rng, SECURE_CODING_BANK)


def generate_monitoring_question(rng: random.Random) -> dict:
    return _from_bank(rng, MONITORING_BANK)


def generate_incident_response_question(rng: random.Random) -> dict:
    return _from_bank(rng, INCIDENT_RESPONSE_BANK)


def generate_crypto_hygiene_question(rng: random.Random) -> dict:
    return _from_bank(rng, CRYPTO_HYGIENE_BANK)
```

Register them in the existing `GENERATORS` dict and add the round-3 assigner plus a generic lookup used by `round_key.plaintext_key`:

```python
GENERATORS.update(
    {
        "access_control": generate_access_control_question,
        "secure_coding": generate_secure_coding_question,
        "monitoring": generate_monitoring_question,
        "incident_response": generate_incident_response_question,
        "crypto_hygiene": generate_crypto_hygiene_question,
    }
)

BLUEPRINTS: dict[int, list[tuple[str, int]]] = {
    1: BLUEPRINT,
    2: ROUND2_BLUEPRINT,
    3: ROUND3_BLUEPRINT,
}


def assign_round3(db: Session, team: Team) -> list[TeamQuestion]:
    return assign_round(db, team, 3, ROUND3_BLUEPRINT)


def assign_round_for(db: Session, team: Team, round_number: int) -> list[TeamQuestion]:
    """Round-number-indexed entry point so callers that work generically over
    rounds (round_key, admin dev tools) don't each hardcode the mapping."""
    blueprint = BLUEPRINTS.get(round_number)
    if blueprint is None:
        return []
    return assign_round(db, team, round_number, blueprint)
```

Round 2 questions currently pass `code_fragment=None` to the board but the generator already stores one on the `Question` row, so `plaintext_key` works for rounds 2 and 3 without a schema change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_question_gen_round3.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/question_gen.py backend/tests/test_question_gen_round3.py
git commit -m "feat: add round 3 MCQ bank from stage 3 questions"
```

---

## Task 3: Round unlock model and migration

**Files:**
- Create: `backend/app/models/round_key.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/c3f1a20b7de4_four_rounds_anagram_gates.py`

- [ ] **Step 1: Add the models**

```python
# backend/app/models/round_key.py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class RoundUnlock(Base):
    """One row per (team, round) that has been unlocked by solving the
    previous round's anagram. Presence of the row IS the unlock — no
    separate boolean lives anywhere else."""

    __tablename__ = "round_unlocks"
    __table_args__ = (UniqueConstraint("team_id", "round_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    round_number: Mapped[int] = mapped_column(Integer)
    unlocked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class RoundKeyAttempt(Base):
    """Audit trail of anagram submissions (also what the rate limiter reads)."""

    __tablename__ = "round_key_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    round_number: Mapped[int] = mapped_column(Integer)
    submitted: Mapped[str] = mapped_column(String)
    correct: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

Export both from `backend/app/models/__init__.py` alongside the existing models.

- [ ] **Step 2: Write the migration**

```python
# backend/alembic/versions/c3f1a20b7de4_four_rounds_anagram_gates.py
"""four rounds + anagram gates

Revision ID: c3f1a20b7de4
Revises: b2d8e4f1a6c3
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c3f1a20b7de4"
down_revision = "b2d8e4f1a6c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "round_unlocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("unlocked_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("team_id", "round_number", name="uq_round_unlocks_team_round"),
    )
    op.create_table(
        "round_key_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("submitted", sa.String(), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Backfill so teams mid-event do not regress: any team whose round 1 is
    # fully solved keeps round 2 open, and any team that already passed the
    # old Master Terminal keeps round 3 open.
    op.execute(
        """
        INSERT INTO round_unlocks (id, team_id, round_number)
        SELECT gen_random_uuid(), tq.team_id, 2
        FROM team_questions tq
        JOIN questions q ON q.id = tq.question_id
        WHERE q.round = 1
        GROUP BY tq.team_id
        HAVING COUNT(*) = COUNT(*) FILTER (WHERE tq.status = 'solved')
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO round_unlocks (id, team_id, round_number)
        SELECT gen_random_uuid(), ma.team_id, 3
        FROM master_attempts ma
        WHERE ma.correct IS TRUE
        GROUP BY ma.team_id
        ON CONFLICT DO NOTHING
        """
    )
    # The upload round moved 3 -> 4; carry its deadline setting across.
    op.execute("UPDATE event_settings SET key = 'round4_deadline' WHERE key = 'round3_deadline'")


def downgrade() -> None:
    op.execute("UPDATE event_settings SET key = 'round3_deadline' WHERE key = 'round4_deadline'")
    op.drop_table("round_key_attempts")
    op.drop_table("round_unlocks")
```

- [ ] **Step 3: Verify the migration applies and reverses**

Run:
```bash
docker compose up -d db
cd backend && .venv/bin/alembic upgrade head && .venv/bin/alembic downgrade -1 && .venv/bin/alembic upgrade head
```
Expected: three successful runs, no error output; `\dt` shows `round_unlocks` and `round_key_attempts`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/round_key.py backend/app/models/__init__.py backend/alembic/versions/c3f1a20b7de4_four_rounds_anagram_gates.py
git commit -m "feat: add round unlock tables and migration"
```

---

## Task 4: Gate-based round unlock rule

**Files:**
- Modify: `backend/app/services/round_gate.py`
- Delete: `backend/app/services/master_gate.py`
- Test: `backend/tests/test_round_gate.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_round_gate.py
from app.services.round_gate import ROUND_COUNT, requires_gate


def test_round_one_is_always_open_and_later_rounds_need_a_gate():
    assert not requires_gate(1)
    assert requires_gate(2)
    assert requires_gate(3)
    assert requires_gate(4)
    assert ROUND_COUNT == 4
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_round_gate.py -v`
Expected: FAIL with `ImportError: cannot import name 'ROUND_COUNT'`

- [ ] **Step 3: Rewrite the gate rule**

```python
# backend/app/services/round_gate.py
"""Single source of truth for round-unlock state.

Round 1 is always open. Every later round opens only when the team has
solved the previous round's anagram key, recorded as a RoundUnlock row.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Question, RoundUnlock, Team, TeamQuestion
from app.models.enums import TeamQuestionStatus

ROUND_COUNT = 4
MCQ_ROUNDS = (1, 2, 3)
UPLOAD_ROUND = 4


def requires_gate(round_number: int) -> bool:
    return round_number > 1


def round_fully_solved(db: Session, team_id, round_number: int) -> bool:
    total, solved = db.execute(
        select(
            func.count(),
            func.count().filter(TeamQuestion.status == TeamQuestionStatus.solved),
        )
        .select_from(TeamQuestion)
        .join(Question, Question.id == TeamQuestion.question_id)
        .where(TeamQuestion.team_id == team_id, Question.round == round_number)
    ).one()
    return total > 0 and total == solved


def is_round_unlocked(db: Session, team: Team, round_number: int) -> bool:
    if not requires_gate(round_number):
        return True
    return (
        db.scalar(
            select(RoundUnlock.id).where(
                RoundUnlock.team_id == team.id,
                RoundUnlock.round_number == round_number,
            )
        )
        is not None
    )
```

Delete `backend/app/services/master_gate.py` and remove its imports from `teams.py` and `master.py` (the latter is deleted in Task 5).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_round_gate.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/round_gate.py backend/tests/test_round_gate.py
git rm backend/app/services/master_gate.py
git commit -m "feat: gate rounds on solved anagram keys"
```

---

## Task 5: Gate API

**Files:**
- Create: `backend/app/routers/gates.py`
- Create: `backend/app/schemas/gate.py`
- Modify: `backend/app/main.py`
- Delete: `backend/app/routers/master.py`

- [ ] **Step 1: Add the schemas**

```python
# backend/app/schemas/gate.py
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
```

- [ ] **Step 2: Add the router**

```python
# backend/app/routers/gates.py
"""Cipher gates between rounds.

Finishing round N-1 produces a per-team key; the team sees it scrambled and
must submit the unscrambled form to open round N. This replaces the old
one-off Master Terminal so there is a single unlock concept in the system.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models import RoundKeyAttempt, RoundUnlock, Team, User
from app.schemas.gate import GateStatusOut, GateUnlockIn, GateUnlockOut
from app.services.round_gate import ROUND_COUNT, requires_gate
from app.services.round_key import keys_match, plaintext_key, scramble_key
from app.websocket.manager import broadcast_from_sync

router = APIRouter(prefix="/gates", tags=["gates"])


def _require_team(user: User = Depends(get_current_user)) -> User:
    if user.team_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no team for this user")
    return user


def _validate_round(round_number: int) -> int:
    if not (2 <= round_number <= ROUND_COUNT) or not requires_gate(round_number):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No gate for that round")
    return round_number


def _is_unlocked(db: Session, team_id, round_number: int) -> bool:
    return (
        db.scalar(
            select(RoundUnlock.id).where(
                RoundUnlock.team_id == team_id, RoundUnlock.round_number == round_number
            )
        )
        is not None
    )


@router.get("/{round_number}", response_model=GateStatusOut)
def get_gate(
    round_number: int,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    _validate_round(round_number)
    team = db.get(Team, user.team_id)
    source_round = round_number - 1

    unlocked = _is_unlocked(db, team.id, round_number)
    plain = plaintext_key(db, team, source_round)
    attempts = db.scalar(
        select(func.count())
        .select_from(RoundKeyAttempt)
        .where(
            RoundKeyAttempt.team_id == team.id,
            RoundKeyAttempt.round_number == round_number,
        )
    )

    return GateStatusOut(
        round_number=round_number,
        source_round=source_round,
        ready=plain is not None,
        unlocked=unlocked,
        # SECURITY: only the scrambled form is ever sent to the client. The
        # plaintext never leaves the server until the team submits it back.
        scrambled_key=(
            scramble_key(plain, team.team_code, source_round)
            if plain is not None and not unlocked
            else None
        ),
        attempts=attempts or 0,
    )


@router.post("/{round_number}/unlock", response_model=GateUnlockOut)
def unlock_gate(
    round_number: int,
    payload: GateUnlockIn,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    _validate_round(round_number)
    team = db.get(Team, user.team_id)
    source_round = round_number - 1

    if _is_unlocked(db, team.id, round_number):
        return GateUnlockOut(
            correct=True, message=f"Round {round_number} already unlocked", unlocked=True
        )

    plain = plaintext_key(db, team, source_round)
    if plain is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, f"Finish Round {source_round} first"
        )

    correct = keys_match(payload.key, plain)
    db.add(
        RoundKeyAttempt(
            team_id=team.id,
            user_id=user.id,
            round_number=round_number,
            submitted=payload.key[:120],
            correct=correct,
        )
    )
    if correct:
        db.add(
            RoundUnlock(team_id=team.id, round_number=round_number, unlocked_by=user.id)
        )
    db.commit()

    if not correct:
        return GateUnlockOut(
            correct=False, message="KEY REJECTED — the letters do not match", unlocked=False
        )

    broadcast_from_sync(
        team.id, {"type": "round_unlocked", "round_number": round_number}
    )
    return GateUnlockOut(
        correct=True, message=f"KEY ACCEPTED — Round {round_number} unlocked", unlocked=True
    )
```

Register `gates.router` in `backend/app/main.py` and remove the `master` router import/registration. Delete `backend/app/routers/master.py`.

- [ ] **Step 3: Add an API test**

```python
# backend/tests/test_gates_api.py
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_gate_for_round_one_is_not_addressable(client):
    res = client.get("/gates/1")
    # 401 (no auth) or 404 (no gate) are both correct rejections; what must
    # never happen is a 200 exposing a gate for the always-open round.
    assert res.status_code in (401, 404)
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && .venv/bin/python -m pytest tests -v`
Expected: PASS, all tests

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/gates.py backend/app/schemas/gate.py backend/app/main.py backend/tests/test_gates_api.py
git rm backend/app/routers/master.py
git commit -m "feat: add cipher gate API replacing master terminal"
```

---

## Task 6: Round 3 board and round 4 upload wiring

**Files:**
- Modify: `backend/app/routers/questions.py`
- Modify: `backend/app/routers/submissions.py`
- Modify: `backend/app/schemas/question.py`

- [ ] **Step 1: Collapse the three MCQ boards into one round-parameterised route**

Replace the duplicated `get_round1_board` / `get_round2_board` bodies with a shared helper and expose `/questions/round/{round_number}` for rounds 1-3, keeping the existing paths working:

```python
@router.get("/round/{round_number}", response_model=RoundBoardOut)
def get_round_board(
    round_number: int,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    if round_number not in MCQ_ROUNDS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No MCQ board for that round")
    team = db.get(Team, user.team_id)
    if not is_round_unlocked(db, team, round_number):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Round {round_number} is locked")

    team_questions = assign_round_for(db, team, round_number)
    members = db.scalars(select(User).where(User.team_id == user.team_id)).all()
    name_by_id = {m.id: m.name for m in members}

    items: list[QuestionBoardItem] = []
    summary: dict[str, str] = {}
    all_solved = True
    for tq in team_questions:
        q = tq.question
        solved = tq.status == TeamQuestionStatus.solved
        if not solved:
            all_solved = False
        items.append(
            QuestionBoardItem(
                team_question_id=tq.id,
                category=q.category,
                difficulty=q.difficulty,
                question_text=q.question_text,
                options=q.options,
                status=tq.status.value,
                claimed_by_name=name_by_id.get(tq.assigned_to) if tq.assigned_to else None,
                code_fragment=q.code_fragment if solved else None,
                judge_approved=None,
            )
        )
        if solved:
            summary[q.category] = q.correct_answer

    all_complete = all_solved and bool(team_questions)
    return RoundBoardOut(
        questions=items,
        all_complete=all_complete,
        # Every MCQ round now ends in a gate, so the board only says
        # "complete"; the key itself is served by GET /gates/{round+1}.
        next_gate_round=round_number + 1 if all_complete else None,
        investigation_complete=all_complete and round_number == 2,
        summary=summary if (all_complete and round_number == 2) else None,
        awaiting_judge_approval=False,
    )
```

Add `next_gate_round: int | None = None` to `RoundBoardOut` and drop the now-unused `access_key` field (the gate endpoint owns key display). Answering a question keeps returning `code_fragment` so the board can show fragments as they are earned.

- [ ] **Step 2: Move the upload round to 4**

In `backend/app/routers/submissions.py`: change `require_round_unlocked(3)` to `require_round_unlocked(4)`, rename `_get_round3_deadline` to `_get_round4_deadline`, and read the `round4_deadline` EventSettings key. Update the module docstring accordingly.

- [ ] **Step 3: Verify the backend boots and routes are correct**

Run:
```bash
cd backend && .venv/bin/python -c "from app.main import app; print(sorted({r.path for r in app.routes}))"
```
Expected: includes `/gates/{round_number}`, `/questions/round/{round_number}`, `/submissions`, and no `/master/...` path.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/questions.py backend/app/routers/submissions.py backend/app/schemas/question.py
git commit -m "feat: add round 3 board and move uploads to round 4"
```

---

## Task 7: Dashboard, admin, judging, and seed renumbering

**Files:**
- Modify: `backend/app/routers/teams.py`, `backend/app/schemas/team.py`
- Modify: `backend/app/routers/admin.py`, `backend/app/schemas/admin.py`
- Modify: `backend/app/routers/judging.py`, `backend/app/schemas/judging.py`
- Modify: `backend/app/seed.py`

- [ ] **Step 1: Four-round dashboard payload**

In `backend/app/schemas/team.py`, replace `RoundsOut`/`MasterProgress` with:

```python
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
```

In `backend/app/routers/teams.py`, build `round3` with the existing `_round_progress(db, team_id, 3, ...)` helper, rename `_round3_progress` to `_upload_round_progress` and use it for `round4`, and emit one `GateProgress` per gated round (2, 3, 4) using `plaintext_key(...) is not None` for `ready` and the `RoundUnlock` lookup for `unlocked`. Drop the `master` field and the `master_gate` import.

- [ ] **Step 2: Admin and judging renumbering**

- `admin.py`: `round3_count` becomes `round4_count` (teams with a current submission) and add `round3_count` as a touched-count over `Question.round == 3`; extend the batched progress query from `Question.round.in_([1, 2])` to `[1, 2, 3]`; rename `round3_case` to `round4_case`; change the dev unlock route to insert a `RoundUnlock` row for the requested round (replacing the force-solve hack) and accept rounds 2-4.
- `judging.py`: rename `round3_submitted` to `round4_submitted`, add `round3_complete=round_fully_solved(db, team.id, 3)` beside the existing round1/round2 flags, and update `schemas/judging.py` to match. Scoring logic itself is unchanged.

- [ ] **Step 3: Seed script**

In `backend/app/seed.py`, import `ROUND3_BLUEPRINT`, assign round 3 for the demo teams the same way round 2 is assigned, and insert `RoundUnlock` rows for the demo team that is meant to be mid-round-4 so the seeded state matches the new gate rule. Keep the script idempotent by guarding each insert on the `(team_id, round_number)` natural key.

- [ ] **Step 4: Verify**

Run:
```bash
cd backend && .venv/bin/python -m pytest tests -v && .venv/bin/python -m app.seed && .venv/bin/python -m app.seed
```
Expected: tests pass; the seed runs twice with no duplicate-key errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app
git commit -m "feat: renumber rounds across dashboard admin judging and seed"
```

---

## Task 8: Frontend API client

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Replace master helpers with gate helpers**

```ts
export type GateStatusOut = {
  round_number: number;
  source_round: number;
  ready: boolean;
  unlocked: boolean;
  scrambled_key: string | null;
  attempts: number;
};

export type GateUnlockOut = {
  correct: boolean;
  message: string;
  unlocked: boolean;
};

export async function getGate(roundNumber: number) {
  return request<GateStatusOut>(`/gates/${roundNumber}`);
}

export async function unlockGate(roundNumber: number, key: string) {
  return request<GateUnlockOut>(`/gates/${roundNumber}/unlock`, {
    method: "POST",
    body: JSON.stringify({ key }),
  });
}

export async function getRoundBoard(roundNumber: number) {
  return request<RoundBoardOut>(`/questions/round/${roundNumber}`);
}
```

Delete `getMasterStatus`, `verifyMasterCode`, `MasterStatusOut`, and `MasterVerifyOut`. Update `TeamMeOut["rounds"]` to the four-round + `gates` shape, rename `round3_submitted` to `round4_submitted` in the judging types, and add `next_gate_round` to the round board type.

- [ ] **Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors only in files not yet migrated (Tasks 9-11); no errors inside `lib/api.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add gate API client"
```

---

## Task 9: Cipher gate screen

**Files:**
- Create: `frontend/features/gate/gate-types.ts`, `gate-fixtures.ts`, `gate-view.tsx`
- Create: `frontend/app/gate/[round]/page.tsx`
- Delete: `frontend/app/master/page.tsx`
- Test: `frontend/test/gate-view.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/test/gate-view.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GateView } from "@/features/gate/gate-view";
import { lockedGateFixture, readyGateFixture, unlockedGateFixture } from "@/features/gate/gate-fixtures";

describe("GateView", () => {
  it("hides the key until the source round is finished", () => {
    render(<GateView model={lockedGateFixture} onChangeKey={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/finish round 1/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /unscrambled key/i })).not.toBeInTheDocument();
  });

  it("shows the scrambled key and submits the unscrambled answer", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<GateView model={readyGateFixture} onChangeKey={vi.fn()} onSubmit={onSubmit} onBack={vi.fn()} />);

    expect(screen.getByText(readyGateFixture.scrambledKey!)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /unlock round 2/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("confirms an unlocked gate and offers the next round", () => {
    render(<GateView model={unlockedGateFixture} onChangeKey={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/key accepted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter round 2/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run test/gate-view.test.tsx`
Expected: FAIL, cannot resolve `@/features/gate/gate-view`

- [ ] **Step 3: Implement types, fixtures, and view**

```ts
// frontend/features/gate/gate-types.ts
export type GateState = "loading" | "locked" | "ready" | "submitting" | "rejected" | "unlocked";

export type GateViewModel = {
  state: GateState;
  roundNumber: number;
  sourceRound: number;
  scrambledKey: string | null;
  answer: string;
  attempts: number;
  message: string | null;
};
```

```ts
// frontend/features/gate/gate-fixtures.ts
import type { GateViewModel } from "./gate-types";

export const lockedGateFixture: GateViewModel = {
  state: "locked",
  roundNumber: 2,
  sourceRound: 1,
  scrambledKey: null,
  answer: "",
  attempts: 0,
  message: null,
};

export const readyGateFixture: GateViewModel = {
  ...lockedGateFixture,
  state: "ready",
  scrambledKey: "DIGI-BA-Z7-4Q",
};

export const unlockedGateFixture: GateViewModel = {
  ...readyGateFixture,
  state: "unlocked",
  message: "KEY ACCEPTED — Round 2 unlocked",
};
```

`gate-view.tsx` renders, per state: a locked panel reading `Finish Round {sourceRound} to receive the cipher key`; a ready panel showing the scrambled key in monospace with a labelled `Unscrambled key` textbox and an `Unlock Round {roundNumber}` button; a rejected panel that keeps the input and shows the attempt count; an unlocked panel showing `KEY ACCEPTED` and an `Enter Round {roundNumber}` button. It reuses `EventHeader`, `EventPanel`, and `Button` so it matches the round screens.

`frontend/app/gate/[round]/page.tsx` fetches `getGate(round)`, maps the response into `GateViewModel`, calls `unlockGate` on submit, refetches on the `round_unlocked` websocket event, and navigates to `/round{round}` from the unlocked state. Delete `frontend/app/master/page.tsx`; add a `frontend/app/master/page.tsx` replacement that immediately redirects to `/dashboard` so any bookmarked link still lands somewhere sensible.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run test/gate-view.test.tsx`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/features/gate frontend/app/gate frontend/app/master frontend/test/gate-view.test.tsx
git commit -m "feat: add cipher gate screen"
```

---

## Task 10: Round 3 MCQ screen and round 4 upload move

**Files:**
- Create: `frontend/features/round3/round3-types.ts`, `round3-fixtures.ts`, `round3-view.tsx`
- Modify: `frontend/app/round3/page.tsx` (becomes the MCQ container)
- Create: `frontend/app/round4/page.tsx` (the previous round 3 upload container, moved verbatim apart from copy and the round number)
- Test: `frontend/test/round3-view.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/test/round3-view.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Round3View } from "@/features/round3/round3-view";
import { activeRound3Fixture, completeRound3Fixture } from "@/features/round3/round3-fixtures";

describe("Round3View", () => {
  it("renders the defensive-prototyping brief and the question list", () => {
    render(<Round3View model={activeRound3Fixture} onSelect={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/final hack/i);
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
  });

  it("points at the round 4 gate once every question is solved", () => {
    render(<Round3View model={completeRound3Fixture} onSelect={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole("button", { name: /cipher gate/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run test/round3-view.test.tsx`
Expected: FAIL, cannot resolve `@/features/round3/round3-view`

- [ ] **Step 3: Implement round 3 and move the upload page**

Round 3 mirrors the round 2 feature exactly: same `Round3Clue`/`Round3ViewModel` shape, same claim/answer interactions, `EventHeader` eyebrow `Round 3 // The Final Hack`. On completion it shows a `Cipher gate` button that routes to `/gate/4`. `frontend/app/round3/page.tsx` becomes the MCQ container calling `getRoundBoard(3)`.

`frontend/app/round4/page.tsx` is the current upload page moved as-is: same upload/current/history calls, with copy updated from "Round 3" to "Round 4" and the deadline message wording unchanged otherwise.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run test/round3-view.test.tsx test/round2-view.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/features/round3 frontend/app/round3 frontend/app/round4 frontend/test/round3-view.test.tsx
git commit -m "feat: add round 3 MCQ screen and move uploads to round 4"
```

---

## Task 11: Dashboard, dev preview, admin and judge UI

**Files:**
- Modify: `frontend/features/dashboard/dashboard-fixtures.ts`, `dashboard-view.tsx`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/lib/dev-preview.ts`, `frontend/components/dev/preview-toolbar.tsx`, `frontend/app/dev/preview/page.tsx`
- Modify: `frontend/app/admin/page.tsx`, `frontend/app/admin/settings/page.tsx`, `frontend/app/admin/teams/page.tsx`, `frontend/app/judge/page.tsx`, `frontend/app/judge/teams/[id]/page.tsx`
- Modify: `frontend/app/page.tsx` (landing copy: four stages)
- Test: `frontend/test/dashboard-view.test.tsx`, `frontend/test/dev-preview.test.tsx`

- [ ] **Step 1: Extend the dashboard test**

```tsx
it("shows four rounds and routes a ready gate to the cipher screen", async () => {
  const onNavigate = vi.fn();
  const user = userEvent.setup();
  render(<DashboardView model={gateReadyDashboardFixture} onNavigate={onNavigate} onLogout={vi.fn()} />);

  const progression = screen.getByRole("list", { name: "Mission progression" });
  expect(within(progression).getAllByRole("listitem")).toHaveLength(4);

  await user.click(screen.getByRole("button", { name: /open cipher gate/i }));
  expect(onNavigate).toHaveBeenCalledWith("/gate/2");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run test/dashboard-view.test.tsx`
Expected: FAIL, `gateReadyDashboardFixture` is not exported and only three rounds render

- [ ] **Step 3: Implement**

- `dashboard-fixtures.ts`: add a fourth round entry to every fixture, add `gates` to the view model, and export `gateReadyDashboardFixture` where round 1 is complete and gate 2 is ready but not unlocked.
- `dashboard-view.tsx`: render four rounds; when a gate is `ready && !unlocked`, the prominent action becomes `Open cipher gate` targeting `/gate/{round}`. This keeps the "exactly one prominent action" invariant the existing test asserts.
- `dashboard/page.tsx`: map the new API payload (`round4`, `gates`) into the view model; replace the master-terminal navigation with gate navigation.
- `dev-preview.ts` / `preview-toolbar.tsx` / `dev/preview/*`: replace the `master` preview route with `gate`, add a `round3` MCQ preview, and move the old round 3 preview to `round4`.
- Admin/judge pages: rename `round3_submitted` to `round4_submitted`, show a round 3 completion column, and update the settings page's deadline field label to Round 4.
- `frontend/app/page.tsx`: the stages section lists four rounds; the finale copy describes the cipher gates instead of a single Master Code.

- [ ] **Step 4: Run the full frontend suite**

Run: `cd frontend && npm test -- --run && npm run lint && npm run build`
Expected: all tests pass, lint clean, build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: show four rounds and cipher gates across the UI"
```

---

## Task 12: End-to-end verification and deployment

- [ ] **Step 1: Rebuild and start the stack**

Run: `docker compose up --build -d`
Expected: exit 0, all three containers healthy

- [ ] **Step 2: Apply migrations and seed**

Run:
```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.seed
```
Expected: migration reports `c3f1a20b7de4` as head; seed completes without error

- [ ] **Step 3: Walk one team through the whole flow**

Run a scripted check against the running stack that logs in as a seeded participant, then in order: answers every round 1 question, reads `GET /gates/2` and asserts `scrambled_key` is a permutation of the round 1 key, posts the unscrambled key, confirms round 2 opens, repeats for gates 3 and 4, and finally uploads a `.pptx` to `/submissions`.

Expected: each gate rejects a wrong key with `correct: false` and accepts the right one; `/teams/me` reports four rounds with the expected locked/unlocked states; the upload succeeds only after gate 4 is solved.

- [ ] **Step 4: Confirm no stale references remain**

Run: `rg -n "master_gate|MasterAttempt|/master|round3_deadline|round3_submitted" backend frontend --glob '!node_modules' --glob '!.venv'`
Expected: only the alembic migration's historical backfill query and the `/master` redirect page match

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "feat: four-round flow with anagram cipher gates"
git push origin HEAD:main
```

---

## Self-review notes

- **Spec coverage:** round 3 becomes MCQ (Tasks 2, 6, 10), old round 3 becomes round 4 (Tasks 6, 10), per-round per-team anagram keys gate progression (Tasks 1, 3, 4, 5, 9), Master Terminal removed (Tasks 4, 5, 9), workflow otherwise unchanged (behavioural contract, plus Tasks 7 and 11 which only renumber).
- **Existing teams:** the migration backfills `RoundUnlock` rows from solved round 1 questions and from correct `master_attempts`, so a team mid-event does not lose access.
- **Key secrecy:** only the scrambled key is ever serialised to a client; the plaintext is recomputed server-side on submit.
- **Naming consistency:** `plaintext_key`, `scramble_key`, `keys_match`, `assign_round_for`, `RoundUnlock`, `RoundKeyAttempt`, `GateStatusOut`, `GateUnlockOut`, `getGate`, `unlockGate` are used with the same signatures in every task that references them.
