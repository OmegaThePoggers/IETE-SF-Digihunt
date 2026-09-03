# Phrase Anagram Cipher Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the cipher challenge into the anagram itself by making each round's key a themed real phrase whose scrambled letters teams must rearrange, instead of a random fragment string whose order the UI already gives away.

**Architecture:** Each round gains a deterministic per-team phrase drawn from a themed bank, seeded on `team_code` and round so it stays reproducible without storing secrets. Fragments become consecutive slices of that phrase's letters, so solving MCQs still reveals recoverable material, but the recovered material no longer spells the answer in order. The gate shows the phrase's letters scrambled plus a themed hint and the expected word shape, and `keys_match` normalizes spacing so teams may type the phrase naturally. Fragment ordering is deliberately removed from every UI surface.

**Tech Stack:** FastAPI, SQLAlchemy, Next.js, React, TypeScript, Tailwind CSS, pytest, Vitest, React Testing Library.

---

## Why the current design is too easy

`backend/app/services/round_key.py:68-81` builds the plaintext by joining fragments in question order, and `frontend/features/round1/round1-view.tsx:161-166`, `frontend/features/round2/round2-view.tsx:67`, `frontend/features/round3/round3-view.tsx:52`, and `frontend/features/gate/gate-view.tsx:67-76` all render those fragments as a numbered list. The displayed order is the answer order, so the anagram adds no difficulty.

## Target behavior

- Round N's plaintext key is a themed phrase, for example `PHISHING PAYLOAD`.
- Solving each MCQ reveals one fragment, which is a slice of the phrase's letters in a per-team shuffled arrangement.
- The gate shows the scrambled letters, a themed hint, and the word-length pattern, for example `8 · 7`.
- The gate accepts the phrase with any spacing and any letter case.
- No screen numbers the fragments or implies their order.

## File structure

- Create: `backend/app/services/key_phrases.py` — themed phrase banks and deterministic per-team phrase selection.
- Modify: `backend/app/services/round_key.py` — build plaintext from the phrase, expose hint and shape, normalize submitted spacing.
- Modify: `backend/app/services/question_gen.py` — derive fragments from the round phrase rather than random characters.
- Modify: `backend/app/schemas/gate.py` — carry `hint` and `word_lengths`.
- Modify: `backend/app/routers/gates.py` — return the new gate fields.
- Create: `backend/tests/test_key_phrases.py` — phrase determinism and coverage.
- Modify: `backend/tests/test_round_key.py` — phrase-based scramble and spacing-insensitive matching.
- Modify: `frontend/lib/api.ts` — extend `GateStatusOut`.
- Modify: `frontend/features/gate/gate-types.ts`, `gate-fixtures.ts`, `gate-view.tsx` — show hint and shape, drop the ordered list.
- Modify: `frontend/app/gate/[round]/page.tsx` — pass the new fields, stop deriving ordered fragments.
- Modify: `frontend/features/round1/round1-view.tsx`, `round2/round2-view.tsx`, `round3/round3-view.tsx` — show recovered fragments unordered.
- Modify: `frontend/test/gate-view.test.tsx`, `round1-view.test.tsx`, `round2-view.test.tsx`, `round3-view.test.tsx` — cover the new behavior.

---

### Task 1: Deterministic themed phrase bank

**Files:**
- Create: `backend/app/services/key_phrases.py`
- Test: `backend/tests/test_key_phrases.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_key_phrases.py`:

```python
import pytest

from app.services.key_phrases import PHRASE_BANKS, phrase_for_round


def test_every_mcq_round_has_a_bank():
    assert set(PHRASE_BANKS) == {1, 2, 3}
    for round_number, bank in PHRASE_BANKS.items():
        assert len(bank) >= 4, round_number


def test_phrases_are_upper_case_words_only():
    for bank in PHRASE_BANKS.values():
        for phrase, hint in bank:
            assert phrase == phrase.upper()
            assert phrase.replace(" ", "").isalpha()
            assert hint.strip()


def test_phrase_is_deterministic_per_team_and_round():
    assert phrase_for_round("DGH-009", 1) == phrase_for_round("DGH-009", 1)
    assert phrase_for_round("DGH-009", 1) != phrase_for_round("DGH-009", 2)


def test_phrase_varies_between_teams():
    picks = {phrase_for_round(f"DGH-{n:03d}", 1)[0] for n in range(40)}
    assert len(picks) > 1


def test_unknown_round_raises():
    with pytest.raises(KeyError):
        phrase_for_round("DGH-009", 9)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_key_phrases.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.key_phrases'`.

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/key_phrases.py`:

```python
"""Themed cipher phrases.

The cipher gate's difficulty lives in the anagram, so each round's key is a
real phrase a team can reason toward from the round's theme rather than a
random string. Selection is seeded on team_code and round, so the phrase is
reproducible from public data and never has to be stored as a secret.
"""

import hashlib
import random

# (phrase, hint) pairs. Phrases stay upper case and alphabetic so scrambling
# and matching only ever deal with letters and spaces.
PHRASE_BANKS: dict[int, list[tuple[str, str]]] = {
    1: [
        ("BINARY SIGNAL", "How machines spell every message."),
        ("MORSE BEACON", "Dots, dashes, and a light in the dark."),
        ("CIPHER TRAIL", "The path left by shifted letters."),
        ("SILENT PACKET", "Data that moved without being noticed."),
        ("HIDDEN DIGITS", "Numbers that were never meant to be read."),
    ],
    2: [
        ("PHISHING PAYLOAD", "The bait arrived as an attachment."),
        ("STOLEN SESSION", "Someone else is wearing your login."),
        ("MIDNIGHT BREACH", "The logs point at the small hours."),
        ("EXPORTED RECORDS", "The database left through the front door."),
        ("INSIDER MOTIVE", "Ask why before you ask who."),
    ],
    3: [
        ("ACCESS DENIED", "The only safe default for a stranger."),
        ("SECURE PROTOTYPE", "Lock it down before you ship it."),
        ("AUDIT PIPELINE", "Every action leaves a record."),
        ("QUARANTINE ALERT", "Hold the change, raise the flag."),
        ("PATCHED GATEWAY", "The hole in the wall is closed."),
    ],
}


def phrase_for_round(team_code: str, round_number: int) -> tuple[str, str]:
    """Return the (phrase, hint) this team must unscramble for a round."""
    bank = PHRASE_BANKS[round_number]
    seed = hashlib.sha256(f"{team_code}:phrase:{round_number}".encode()).hexdigest()
    return random.Random(int(seed, 16)).choice(bank)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_key_phrases.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/key_phrases.py backend/tests/test_key_phrases.py
git commit -m "feat: add themed cipher phrase bank"
```

### Task 2: Build round keys and fragments from the phrase

**Files:**
- Modify: `backend/app/services/round_key.py:18-81`
- Modify: `backend/app/services/question_gen.py`
- Test: `backend/tests/test_round_key.py`

- [ ] **Step 1: Write the failing test**

Replace the whole body of `backend/tests/test_round_key.py` with:

```python
from app.services.key_phrases import phrase_for_round
from app.services.round_key import (
    fragments_for_phrase,
    keys_match,
    scramble_key,
    word_lengths,
)


def test_scramble_keeps_letters_but_not_order():
    scrambled = scramble_key("PHISHING PAYLOAD", team_code="DGH-009", round_number=2)

    assert scrambled != "PHISHING PAYLOAD"
    assert sorted(scrambled.replace(" ", "")) == sorted("PHISHINGPAYLOAD")


def test_scramble_hides_the_word_boundaries():
    scrambled = scramble_key("PHISHING PAYLOAD", team_code="DGH-009", round_number=2)

    assert " " not in scrambled.strip()


def test_scramble_is_deterministic_per_team_and_round():
    a = scramble_key("ACCESS DENIED", team_code="DGH-009", round_number=3)
    b = scramble_key("ACCESS DENIED", team_code="DGH-009", round_number=3)
    c = scramble_key("ACCESS DENIED", team_code="DGH-001", round_number=3)

    assert a == b
    assert a != c


def test_word_lengths_describe_the_answer_shape():
    assert word_lengths("PHISHING PAYLOAD") == [8, 7]


def test_fragments_cover_every_letter_exactly_once():
    fragments = fragments_for_phrase("PHISHING PAYLOAD", team_code="DGH-009", count=5)

    assert len(fragments) == 5
    assert sorted("".join(fragments)) == sorted("PHISHINGPAYLOAD")


def test_fragments_are_deterministic_and_never_spell_the_answer():
    args = ("PHISHING PAYLOAD", "DGH-009", 5)
    assert fragments_for_phrase(*args) == fragments_for_phrase(*args)
    assert "".join(fragments_for_phrase(*args)) != "PHISHINGPAYLOAD"


def test_keys_match_ignores_case_and_spacing():
    assert keys_match("  phishing   payload ", "PHISHING PAYLOAD")
    assert keys_match("PHISHINGPAYLOAD", "PHISHING PAYLOAD")
    assert not keys_match("PAYLOAD PHISHING", "PHISHING PAYLOAD")


def test_phrase_bank_values_round_trip_through_the_key_helpers():
    phrase, _hint = phrase_for_round("DGH-009", 1)
    scrambled = scramble_key(phrase, team_code="DGH-009", round_number=1)

    assert sorted(scrambled.replace(" ", "")) == sorted(phrase.replace(" ", ""))
    assert keys_match(phrase.lower(), phrase)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_round_key.py -v`

Expected: FAIL with `ImportError: cannot import name 'fragments_for_phrase'`.

- [ ] **Step 3: Rewrite the key service**

Replace the contents of `backend/app/services/round_key.py` with:

```python
"""Per-team round keys and their anagram form.

Finishing a round yields a themed phrase; the team is shown that phrase's
letters scrambled and must rearrange them to unlock the next round. The
challenge lives in the anagram, so fragments deliberately do not spell the
answer in order. Derivation is deterministic (seeded on team_code + round),
so no key material is ever stored as a secret.
"""

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
    """Answer shape shown to the team, e.g. [8, 7] for PHISHING PAYLOAD."""
    return [len(word) for word in phrase.split()]


def scramble_key(plaintext: str, team_code: str, round_number: int) -> str:
    """Shuffle every letter of the phrase and drop word boundaries, so the
    displayed key reveals the letter multiset and nothing else."""
    rng = _rng(team_code, round_number)
    original = list(_letters(plaintext))
    chars = list(original)
    for _ in range(50):
        rng.shuffle(chars)
        if chars != original:
            break
    return "".join(chars)


def fragments_for_phrase(phrase: str, team_code: str, count: int) -> list[str]:
    """Split the phrase's shuffled letters into `count` fragments.

    Every letter appears exactly once across the fragments, so a full board
    hands the team the complete letter multiset, but the fragments are cut
    from a shuffled arrangement and therefore never spell the answer.
    """
    if count <= 0:
        return []
    rng = random.Random(
        int(hashlib.sha256(f"{team_code}:fragments:{phrase}".encode()).hexdigest(), 16)
    )
    letters = list(_letters(phrase))
    rng.shuffle(letters)

    base, extra = divmod(len(letters), count)
    fragments: list[str] = []
    index = 0
    for position in range(count):
        size = base + (1 if position < extra else 0)
        fragments.append("".join(letters[index : index + size]))
        index += size
    return fragments


def keys_match(submitted: str, plaintext: str) -> bool:
    """Spacing-insensitive so a team may type the phrase naturally."""
    return _letters(submitted.strip()) == _letters(plaintext.strip())


def plaintext_key(db: Session, team: Team, round_number: int) -> str | None:
    """None until every TeamQuestion in the round is solved."""
    from app.services.question_gen import assign_round_for

    team_questions = assign_round_for(db, team, round_number)
    if not team_questions:
        return None
    if any(tq.status != TeamQuestionStatus.solved for tq in team_questions):
        return None

    phrase, _hint = phrase_for_round(team.team_code, round_number)
    return phrase


def key_hint(team_code: str, round_number: int) -> str:
    _phrase, hint = phrase_for_round(team_code, round_number)
    return hint
```

- [ ] **Step 4: Derive question fragments from the phrase**

In `backend/app/services/question_gen.py`, inside `assign_round`, after the loop finishes building `team_questions` and before `db.commit()`, assign phrase-derived fragments:

```python
    from app.services.key_phrases import phrase_for_round
    from app.services.round_key import fragments_for_phrase

    phrase, _hint = phrase_for_round(team.team_code, round_number)
    fragments = fragments_for_phrase(phrase, team.team_code, len(team_questions))
    for tq, fragment in zip(team_questions, fragments):
        tq.question.code_fragment = fragment
```

Leave `_fragment` and `FRAGMENT_ALPHABET` in place; they still seed generator output for question bodies.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_round_key.py tests/test_key_phrases.py -v`

Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && uv run pytest`

Expected: all tests pass. If `tests/test_gates_api.py` asserts an old `DIGI-` key shape, update those assertions to use `phrase_for_round` and `keys_match` instead.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/round_key.py backend/app/services/question_gen.py backend/tests
git commit -m "feat: build cipher keys from themed phrases"
```

### Task 3: Serve the hint and answer shape

**Files:**
- Modify: `backend/app/schemas/gate.py`
- Modify: `backend/app/routers/gates.py:46-80`
- Test: `backend/tests/test_gates_api.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_gates_api.py`, following that file's existing client and team setup helpers:

```python
def test_gate_status_exposes_hint_and_word_shape(client, solved_round1_team_headers):
    response = client.get("/gates/2", headers=solved_round1_team_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["hint"]
    assert body["word_lengths"]
    assert sum(body["word_lengths"]) == len(body["scrambled_key"])
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_gates_api.py -v`

Expected: FAIL with `KeyError: 'hint'`.

- [ ] **Step 3: Extend the schema**

In `backend/app/schemas/gate.py`, add to `GateStatusOut`:

```python
    hint: str | None = None
    word_lengths: list[int] = []
```

- [ ] **Step 4: Return the new fields**

In `backend/app/routers/gates.py`, import the helpers:

```python
from app.services.round_key import (
    key_hint,
    keys_match,
    plaintext_key,
    scramble_key,
    word_lengths,
)
```

Then in `get_gate`, extend the returned `GateStatusOut` with:

```python
        hint=key_hint(team.team_code, source_round) if plain is not None and not unlocked else None,
        word_lengths=word_lengths(plain) if plain is not None and not unlocked else [],
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_gates_api.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/gate.py backend/app/routers/gates.py backend/tests/test_gates_api.py
git commit -m "feat: serve cipher hint and answer shape"
```

### Task 4: Make the gate an anagram puzzle

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/features/gate/gate-types.ts`
- Modify: `frontend/features/gate/gate-fixtures.ts`
- Modify: `frontend/features/gate/gate-view.tsx:58-93`
- Modify: `frontend/app/gate/[round]/page.tsx`
- Test: `frontend/test/gate-view.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/test/gate-view.test.tsx`, replace the `lists recovered fragments in key order` test with:

```tsx
it("presents the anagram with its hint and answer shape but no fragment order", () => {
  render(
    <GateView
      model={{
        ...readyGateFixture,
        scrambledKey: "IPHSHIGNAPYLDAO",
        hint: "The bait arrived as an attachment.",
        wordLengths: [8, 7],
      }}
      onChangeKey={vi.fn()}
      onSubmit={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  expect(screen.getByText("IPHSHIGNAPYLDAO")).toBeInTheDocument();
  expect(screen.getByText(/the bait arrived as an attachment/i)).toBeInTheDocument();
  expect(screen.getByText("8 · 7")).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: /recovered fragments/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run test/gate-view.test.tsx`

Expected: FAIL, `hint` and `wordLengths` are not known properties.

- [ ] **Step 3: Extend the API type**

In `frontend/lib/api.ts`, add to the `GateStatusOut` interface:

```ts
  hint: string | null;
  word_lengths: number[];
```

- [ ] **Step 4: Replace the gate view model fields**

In `frontend/features/gate/gate-types.ts`, remove `fragments: string[];` and add:

```ts
  hint: string | null;
  wordLengths: number[];
```

In `frontend/features/gate/gate-fixtures.ts`, remove `fragments: [],` from `lockedGateFixture` and add:

```ts
  hint: null,
  wordLengths: [],
```

- [ ] **Step 5: Render the puzzle instead of the ordered list**

In `frontend/features/gate/gate-view.tsx`, replace the whole `model.fragments.length > 0 ? (...) : null` block with:

```tsx
            {model.wordLengths.length > 0 ? (
              <p className="mb-4 font-mono-data text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Answer shape · <span className="text-primary">{model.wordLengths.join(" · ")}</span>
              </p>
            ) : null}

            {model.hint ? (
              <p className="mb-6 border-l-2 border-secondary pl-4 text-sm leading-6 text-muted-foreground">
                {model.hint}
              </p>
            ) : null}
```

Also change the header description for the non-unlocked case to:

```tsx
            : `Rearrange every recovered letter into the phrase this round was hiding.`
```

- [ ] **Step 6: Feed the new fields from the page**

In `frontend/app/gate/[round]/page.tsx`, drop the `getRoundBoard` import, the `fragments` controller state, the `fragments` action field, and the board fetch added for it. Restore `fetchStatus` to `dispatch({ type: "status", status: await getGate(roundNumber) });` and change the model to pass:

```ts
      hint: status?.hint ?? null,
      wordLengths: status?.word_lengths ?? [],
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run test/gate-view.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/api.ts frontend/features/gate frontend/app/gate frontend/test/gate-view.test.tsx
git commit -m "feat: turn the cipher gate into an anagram puzzle"
```

### Task 5: Stop numbering recovered fragments in every round

**Files:**
- Modify: `frontend/features/round1/round1-view.tsx:158-169`
- Modify: `frontend/features/round2/round2-view.tsx:67`
- Modify: `frontend/features/round3/round3-view.tsx:52`
- Test: `frontend/test/round1-view.test.tsx`, `frontend/test/round2-view.test.tsx`, `frontend/test/round3-view.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `frontend/test/round2-view.test.tsx`:

```tsx
it("shows recovered letters without implying their order", () => {
  const model = {
    ...completeRound2Fixture,
    questions: completeRound2Fixture.questions.map((question, index) => ({
      ...question,
      codeFragment: ["HPI", "SGN", "IAP"][index] ?? "YLD",
    })),
  };

  render(<Round2View model={model} {...callbacks()} />);

  const panel = screen.getByRole("region", { name: /recovered letters/i });
  expect(within(panel).getByText("HPI")).toBeInTheDocument();
  expect(within(panel).queryByText(/^1\./)).not.toBeInTheDocument();
});
```

Add the equivalent test to `frontend/test/round1-view.test.tsx` using `completeRound1Fixture` and to `frontend/test/round3-view.test.tsx` using `completeRound3Fixture`, each asserting the `recovered letters` region exists and contains no `1.` prefix.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run test/round1-view.test.tsx test/round2-view.test.tsx test/round3-view.test.tsx`

Expected: FAIL, no accessible region named "Recovered letters".

- [ ] **Step 3: Update Round 1**

In `frontend/features/round1/round1-view.tsx`, replace the recovered-fragments `EventPanel` body with:

```tsx
          <EventPanel variant="muted" aria-label="Recovered letters">
            <h2 className="font-mono-data mb-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">Recovered letters</h2>
            <div className="flex flex-wrap gap-2">
              {model.clues.filter((clue) => clue.status === "solved").map((clue) => (
                <span key={clue.id} className="border border-border px-3 py-1.5 font-mono-data text-sm text-primary">{clue.codeFragment}</span>
              ))}
              {solved === 0 ? <p className="text-sm text-muted-foreground">No letters recovered yet.</p> : null}
            </div>
          </EventPanel>
```

- [ ] **Step 4: Update Round 2**

In `frontend/features/round2/round2-view.tsx`, replace the recovered-fragments panel with:

```tsx
        <EventPanel variant="muted" aria-label="Recovered letters"><h2 className="font-mono-data mb-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">Recovered letters</h2><div className="flex flex-wrap gap-2">{model.questions.filter((q) => q.status === "solved").map((q) => <span key={q.id} className="border border-border px-3 py-1.5 font-mono-data text-sm text-primary">{q.codeFragment}</span>)}{solved === 0 ? <p className="text-sm text-muted-foreground">No letters recovered yet.</p> : null}</div></EventPanel>
```

- [ ] **Step 5: Update Round 3**

In `frontend/features/round3/round3-view.tsx`, replace the recovered-fragments panel with:

```tsx
        <EventPanel variant="muted" aria-label="Recovered letters"><h2 className="font-mono-data mb-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">Recovered letters</h2><div className="flex flex-wrap gap-2">{model.questions.filter((q) => q.status === "solved").map((q) => <span key={q.id} className="border border-border px-3 py-1.5 font-mono-data text-sm text-primary">{q.codeFragment}</span>)}{solved === 0 ? <p className="text-sm text-muted-foreground">No letters recovered yet.</p> : null}</div></EventPanel>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run test/round1-view.test.tsx test/round2-view.test.tsx test/round3-view.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/features/round1 frontend/features/round2 frontend/features/round3 frontend/test
git commit -m "fix: stop revealing fragment order in rounds"
```

### Task 6: Verify the whole flow and publish

**Files:**
- Verify: `backend/app/services/round_key.py`
- Verify: `frontend/features/gate/gate-view.tsx`

- [ ] **Step 1: Run both suites and static checks**

Run:

```bash
cd backend && uv run pytest
cd ../frontend && npm test -- --run && npm run lint && npm run build
```

Expected: all backend tests pass, all frontend tests pass, lint clean, build exits 0.

- [ ] **Step 2: Rebuild the stack**

Run:

```bash
cd .. && docker compose up --build -d
docker compose ps
curl -fsS http://localhost:8000/health
```

Expected: services healthy and `{"status":"ok"}`.

- [ ] **Step 3: Confirm the puzzle is solvable end to end**

Run:

```bash
docker compose exec -T backend python - <<'PY'
from app.core.db import SessionLocal
from app.models import Team
from app.services.round_key import keys_match, plaintext_key, scramble_key, word_lengths
from app.services.key_phrases import phrase_for_round

db = SessionLocal()
try:
    for team in db.query(Team).all():
        plain = plaintext_key(db, team, 1)
        if plain is None:
            continue
        scrambled = scramble_key(plain, team.team_code, 1)
        phrase, hint = phrase_for_round(team.team_code, 1)
        print(team.team_code, "|", scrambled, "|", word_lengths(plain), "|", hint)
        assert sorted(scrambled) == sorted(plain.replace(" ", ""))
        assert keys_match(plain.lower(), plain)
finally:
    db.close()
PY
```

Expected: for every completed team the scrambled letters match the phrase's letters, the shape is printed, and the plaintext phrase is accepted.

- [ ] **Step 4: Reseed questions so existing boards use phrase fragments**

Existing rows still hold random fragments from the previous scheme. Their letters will not match their team's phrase, so the recovered letters would not add up. Regenerate them:

```bash
docker compose exec -T backend python - <<'PY'
from app.core.db import SessionLocal
from app.models import Team
from app.services.key_phrases import phrase_for_round
from app.services.question_gen import assign_round_for
from app.services.round_key import fragments_for_phrase

db = SessionLocal()
try:
    for team in db.query(Team).all():
        for round_number in (1, 2, 3):
            team_questions = assign_round_for(db, team, round_number)
            if not team_questions:
                continue
            phrase, _hint = phrase_for_round(team.team_code, round_number)
            for tq, fragment in zip(
                team_questions,
                fragments_for_phrase(phrase, team.team_code, len(team_questions)),
            ):
                tq.question.code_fragment = fragment
    db.commit()
    print("fragments realigned")
finally:
    db.close()
PY
```

Expected: `fragments realigned`. Re-run Step 3 afterward and confirm it still passes.

- [ ] **Step 5: Publish**

```bash
git status --short
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
git fetch origin main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

Expected: only the pre-existing untracked root files remain, and `HEAD` equals `origin/main`.
