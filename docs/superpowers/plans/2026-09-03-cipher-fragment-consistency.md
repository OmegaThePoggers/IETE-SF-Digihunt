# Cipher Fragment Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every MCQ round reveal its code fragments the same way, surface the ordered fragment list on the cipher gate, and remove visually ambiguous characters from generated fragments.

**Architecture:** Round 2 gains the same `codeFragment` plumbing Rounds 1 and 3 already have (type field, page mapper, solved-card display, recovered-fragments panel). The gate view model gains a read-only ordered fragment list sourced from the round board it gates, so teams assemble the key without leaving the screen. Fragment generation drops `O`, `0`, `I`, `1` so a mono font cannot make two different keys look identical.

**Tech Stack:** FastAPI, SQLAlchemy, Next.js, React, TypeScript, Tailwind CSS, Vitest, React Testing Library, pytest.

---

## Observed inconsistencies

1. `frontend/features/round2/round2-types.ts` has no `codeFragment`, `frontend/app/round2/page.tsx:19` never maps `code_fragment`, and `frontend/features/round2/round2-view.tsx:29` renders `✓ SOLVED`. Round 3 renders `✓ {q.codeFragment ?? "SOLVED"}` and both Rounds 1 and 3 render a "Recovered fragments" panel. Round 2 players therefore never see the fragments the Round 3 gate demands.
2. `frontend/features/gate/gate-view.tsx` shows only `scrambledKey`. The ordered fragment list needed to build the answer lives on a different page.
3. `backend/app/services/question_gen.py:52-54` builds fragments from `string.ascii_uppercase + string.digits`, so `O`/`0` and `I`/`1` are indistinguishable in the mono UI font and produce rejected keys.

## File structure

- Modify: `backend/app/services/question_gen.py` — restrict the fragment alphabet.
- Create: `backend/tests/test_fragment_alphabet.py` — assert generated fragments are unambiguous.
- Modify: `frontend/features/round2/round2-types.ts` — add `codeFragment`.
- Modify: `frontend/app/round2/page.tsx` — map `code_fragment` into the view model.
- Modify: `frontend/features/round2/round2-view.tsx` — show the fragment on solved cards and add the recovered-fragments panel.
- Modify: `frontend/features/round2/round2-fixtures.ts` — give fixtures fragment values.
- Modify: `frontend/test/round2-view.test.tsx` — cover Round 2 fragment display.
- Modify: `frontend/features/gate/gate-types.ts` — add `fragments`.
- Modify: `frontend/features/gate/gate-view.tsx` — render the ordered fragment list.
- Modify: `frontend/app/gate/[round]/page.tsx` — load the source round board and pass fragments.
- Modify: `frontend/test/gate-view.test.tsx` — cover the gate fragment list.

---

### Task 1: Remove ambiguous characters from generated fragments

**Files:**
- Modify: `backend/app/services/question_gen.py:52-54`
- Test: `backend/tests/test_fragment_alphabet.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_fragment_alphabet.py`:

```python
import random

from app.services.question_gen import FRAGMENT_ALPHABET, _fragment

AMBIGUOUS = set("O0I1")


def test_fragment_alphabet_excludes_lookalike_characters():
    assert AMBIGUOUS.isdisjoint(set(FRAGMENT_ALPHABET))


def test_generated_fragments_only_use_the_safe_alphabet():
    rng = random.Random(7)
    for _ in range(200):
        fragment = _fragment(rng)
        assert len(fragment) == 2
        assert set(fragment) <= set(FRAGMENT_ALPHABET)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_fragment_alphabet.py -v`

Expected: FAIL with `ImportError: cannot import name 'FRAGMENT_ALPHABET'`.

- [ ] **Step 3: Write the implementation**

In `backend/app/services/question_gen.py`, replace the `_fragment` helper:

```python
# Mono display fonts render O/0 and I/1 nearly identically, which caused
# teams to submit visually correct but rejected cipher keys.
FRAGMENT_ALPHABET = "".join(
    ch for ch in string.ascii_uppercase + string.digits if ch not in "O0I1"
)


def _fragment(rng: random.Random, length: int = 2) -> str:
    return "".join(rng.choice(FRAGMENT_ALPHABET) for _ in range(length))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_fragment_alphabet.py -v`

Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && uv run pytest`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/question_gen.py backend/tests/test_fragment_alphabet.py
git commit -m "fix: drop lookalike characters from cipher fragments"
```

### Task 2: Show Round 2 fragments like Rounds 1 and 3

**Files:**
- Modify: `frontend/features/round2/round2-types.ts:13-25`
- Modify: `frontend/app/round2/page.tsx:18-20`
- Modify: `frontend/features/round2/round2-view.tsx:29`
- Modify: `frontend/features/round2/round2-fixtures.ts`
- Test: `frontend/test/round2-view.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `frontend/test/round2-view.test.tsx`:

```tsx
it("reveals each solved fragment and lists them in recovery order", () => {
  render(<Round2View model={completeRound2Fixture} {...callbacks()} />);

  const panel = screen.getByRole("region", { name: /recovered fragments/i });
  expect(within(panel).getByText("K7")).toBeInTheDocument();
  expect(within(panel).getByText("M2")).toBeInTheDocument();
  expect(screen.getAllByText(/^✓ [A-Z0-9]{2}$/).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run test/round2-view.test.tsx`

Expected: FAIL, no accessible region named "Recovered fragments".

- [ ] **Step 3: Add the type field**

In `frontend/features/round2/round2-types.ts`, add to `Round2Question` after `claimedByName`:

```ts
  codeFragment: string | null;
```

- [ ] **Step 4: Map the API field**

In `frontend/app/round2/page.tsx`, inside `toQuestion`, add after `claimedByName: q.claimed_by_name,`:

```ts
    codeFragment: q.code_fragment,
```

- [ ] **Step 5: Give the fixtures fragment values**

In `frontend/features/round2/round2-fixtures.ts`, add `codeFragment` to every `Round2Question` literal. Solved questions in `completeRound2Fixture` use real values starting with `"K7"` then `"M2"` for the first two solved questions, and any other two-character value from `A-Z` and `2-9` for the rest. Unsolved questions in all other fixtures use `codeFragment: null`.

- [ ] **Step 6: Render the fragment on solved cards**

In `frontend/features/round2/round2-view.tsx`, replace the solved branch of `QuestionCard`:

```tsx
  if (q.status === "solved") return <div className="flex justify-between border-l-2 border-border py-3 pl-4 text-sm opacity-60"><span>{q.label}</span><span className="font-mono-data text-primary">✓ {q.codeFragment ?? "SOLVED"}</span></div>;
```

- [ ] **Step 7: Add the recovered-fragments panel**

In `frontend/features/round2/round2-view.tsx`, insert this directly before the `Investigation questions` panel in the right-hand `<section>`:

```tsx
        <EventPanel variant="muted" aria-label="Recovered fragments"><h2 className="font-mono-data mb-4 text-xs tracking-[0.16em] uppercase text-muted-foreground">Recovered fragments</h2><div className="space-y-3">{model.questions.filter((q) => q.status === "solved").map((q, index) => <div key={q.id} className="flex justify-between gap-3 border-b border-border pb-2 text-xs"><span className="text-muted-foreground">{index + 1}. {q.label}</span><span className="font-mono-data text-primary">{q.codeFragment}</span></div>)}{solved === 0 ? <p className="text-sm text-muted-foreground">No fragments recovered yet.</p> : null}</div></EventPanel>
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run test/round2-view.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/features/round2 frontend/app/round2/page.tsx frontend/test/round2-view.test.tsx
git commit -m "fix: reveal Round 2 cipher fragments"
```

### Task 3: List the ordered fragments on the cipher gate

**Files:**
- Modify: `frontend/features/gate/gate-types.ts`
- Modify: `frontend/features/gate/gate-view.tsx:58-93`
- Modify: `frontend/app/gate/[round]/page.tsx`
- Test: `frontend/test/gate-view.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `frontend/test/gate-view.test.tsx`:

```tsx
it("lists the recovered fragments in key order beside the scrambled key", () => {
  render(
    <GateView
      model={{
        state: "ready",
        roundNumber: 3,
        sourceRound: 2,
        scrambledKey: "DIGI-7K-2M",
        fragments: ["K7", "M2"],
        answer: "",
        attempts: 0,
        message: null,
      }}
      onChangeKey={vi.fn()}
      onSubmit={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  const list = screen.getByRole("list", { name: /recovered fragments/i });
  expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "1. K7",
    "2. M2",
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run test/gate-view.test.tsx`

Expected: FAIL, `fragments` is not a known property and no list is rendered.

- [ ] **Step 3: Add the view model field**

In `frontend/features/gate/gate-types.ts`, add to `GateViewModel` after `scrambledKey`:

```ts
  fragments: string[];
```

- [ ] **Step 4: Render the fragment list**

In `frontend/features/gate/gate-view.tsx`, insert this immediately after the scrambled-key paragraph and before the `gate-key-input` label:

```tsx
            {model.fragments.length > 0 ? (
              <div className="mb-6">
                <p className="mb-3 font-mono-data text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Recovered fragments
                </p>
                <ol aria-label="Recovered fragments" className="grid gap-2 sm:grid-cols-2">
                  {model.fragments.map((fragment, index) => (
                    <li key={`${index}-${fragment}`} className="border border-border px-3 py-2 font-mono-data text-sm text-primary">
                      {index + 1}. {fragment}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
```

- [ ] **Step 5: Supply fragments from the source round board**

In `frontend/app/gate/[round]/page.tsx`, load the board for `sourceRound` alongside the gate status and pass its solved fragments into the model. Use the existing board fetch helper for that round number, map `board.questions.filter((q) => q.status === "solved").map((q) => q.code_fragment ?? "")`, and default to `[]` whenever the board request fails or the gate is not ready. Every other existing model field stays unchanged.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run test/gate-view.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/features/gate frontend/app/gate frontend/test/gate-view.test.tsx
git commit -m "feat: show recovered fragments on cipher gate"
```

### Task 4: Verify the whole flow and publish

**Files:**
- Verify: `backend/app/services/question_gen.py`
- Verify: `frontend/features/round2/round2-view.tsx`
- Verify: `frontend/features/gate/gate-view.tsx`

- [ ] **Step 1: Run both suites and static checks**

Run:

```bash
cd backend && uv run pytest
cd ../frontend && npm test -- --run && npm run lint && npm run build
```

Expected: backend tests pass, frontend tests pass, lint clean, build exits 0.

- [ ] **Step 2: Rebuild and smoke-test the stack**

Run:

```bash
cd .. && docker compose up --build -d
docker compose ps
curl -fsS http://localhost:8000/health
```

Expected: services healthy and `{"status":"ok"}`.

- [ ] **Step 3: Confirm existing teams keep working keys**

Run:

```bash
docker compose exec -T backend python - <<'PY'
from app.core.db import SessionLocal
from app.models import Team
from app.services.round_key import plaintext_key

db = SessionLocal()
try:
    for team in db.query(Team).all():
        print(team.team_code, plaintext_key(db, team, 1))
finally:
    db.close()
PY
```

Expected: previously generated keys still print unchanged, confirming the alphabet change only affects newly generated questions.

- [ ] **Step 4: Publish**

```bash
git status --short
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
git fetch origin main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

Expected: only the pre-existing untracked root files remain, and `HEAD` equals `origin/main`.
