# Registration Roster Visual Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the registration roster a clear, visually unified table-like form that matches the existing dark DigiHunt UI while retaining the approved one-to-four-person behavior.

**Architecture:** Keep the existing `RegisterForm` state, validation, labels, input IDs, autocomplete values, and API payload unchanged. Replace only the roster's presentation with a compact three-column desktop grid where the ordinal is the sole participant identifier, and use a nested grid on small screens to keep the ordinal beside two vertically stacked fields.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest, React Testing Library.

---

## File structure

- Modify: `frontend/components/auth/register-form.tsx` — simplify roster row markup and responsive Tailwind classes without altering form behavior.
- Modify: `frontend/test/access-pages.test.tsx` — replace the obsolete repeated-label assertion with coverage for one ordinal-led participant row containing its name and email inputs.

### Task 1: Lock the compact-row presentation with a UI test

**Files:**
- Modify: `frontend/test/access-pages.test.tsx:140-146`
- Test: `frontend/test/access-pages.test.tsx`

- [ ] **Step 1: Replace the obsolete visual assertion with a compact-row assertion**

```tsx
it("groups each participant into one compact roster row", () => {
  render(<RegisterPage />);

  expect(screen.getByRole("region", { name: /participant roster/i })).toBeInTheDocument();
  const firstRow = screen.getByRole("group", { name: /participant 1/i });
  expect(firstRow).toHaveTextContent("01");
  expect(firstRow).not.toHaveTextContent("Participant 01");
  expect(within(firstRow).getByLabelText("Member 1 name")).toBeInTheDocument();
  expect(within(firstRow).getByLabelText("Member 1 email")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test to verify it fails under the current repeated-label UI**

Run: `cd frontend && npm test -- --run test/access-pages.test.tsx`

Expected: FAIL because the first roster row still renders `Participant 01`.

### Task 2: Implement the approved homogeneous participant rows

**Files:**
- Modify: `frontend/components/auth/register-form.tsx:95-109`
- Test: `frontend/test/access-pages.test.tsx`

- [ ] **Step 1: Replace each roster row with an ordinal-led responsive grid**

Replace the participant map body with:

```tsx
<div
  key={index}
  role="group"
  aria-label={`Participant ${index + 1}`}
  className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-end sm:gap-x-5 sm:px-5"
>
  <span className="mt-6 grid size-9 place-items-center border border-primary/40 bg-primary/10 font-mono-data text-xs font-bold text-primary sm:mt-0">
    {String(index + 1).padStart(2, "0")}
  </span>
  <div className="grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-2 sm:gap-5">
    {(["name", "email"] as const).map((field) => {
      const label = `Member ${index + 1} ${field}`;
      return (
        <div key={field} className="min-w-0 space-y-1.5">
          <label htmlFor={`member-${index}-${field}`} className="font-mono-data text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
            {field === "name" ? "Full name" : "Email address"}
          </label>
          <input id={`member-${index}-${field}`} className={inputClass} type={field === "email" ? "email" : "text"} value={member[field]} onChange={(event) => updateMember(index, field, event.target.value)} autoComplete={field} aria-label={label} />
        </div>
      );
    })}
  </div>
</div>
```

This removes the redundant `Participant 01` label, prevents field-grid overflow with `min-w-0`, and retains the ordinal next to vertically stacked fields until the `sm` breakpoint.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `cd frontend && npm test -- --run test/access-pages.test.tsx`

Expected: PASS.

- [ ] **Step 3: Commit the focused UI and test change**

```bash
git add frontend/components/auth/register-form.tsx frontend/test/access-pages.test.tsx
git commit -m "fix: unify registration roster rows"
```

### Task 3: Verify integrated registration behavior and production build

**Files:**
- Verify: `frontend/components/auth/register-form.tsx`
- Verify: `frontend/test/access-pages.test.tsx`

- [ ] **Step 1: Run the complete frontend test suite**

Run: `cd frontend && npm test -- --run`

Expected: all frontend tests pass.

- [ ] **Step 2: Run static checks**

Run: `cd frontend && npm run lint && npm run build`

Expected: lint exits successfully and the production build completes.

- [ ] **Step 3: Rebuild and smoke-test the local stack**

Run:

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:3000/register | grep -q 'Participant details'
curl -fsS http://localhost:8000/health
```

Expected: Compose services are healthy, the rendered register page exposes the roster heading, and the backend health endpoint succeeds.

- [ ] **Step 4: Confirm a clean intended change set and publish safely**

Run:

```bash
git status --short
git fetch origin main
git push origin HEAD:main
git fetch origin main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git status --short
```

Expected: only the pre-existing untracked root files remain unstaged and the current commit equals `origin/main`.
