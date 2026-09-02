# Round 2 Review and Judge Workspace Design

## Goal

Keep Round 2 fast and objective through automatic answer validation, while giving judges one reliable workspace for reviewing each team's investigation, latest PowerPoint submission, and final score.

## Current State

The existing system already provides most of the underlying workflow:

- Round 2 questions are multiple-choice and checked automatically by the backend.
- A team can enter Round 3 after completing Round 2 and passing the existing round gates.
- Teams can upload versioned `.ppt` or `.pptx` files.
- Judges can list teams with current submissions, download the latest submission, see a category-to-answer Round 2 summary, save draft scores, and finalize scores.
- Each judge owns an independent score for each team.

The main gap is not a missing approval mechanism. It is that the judge experience only exposes a narrow summary and only lists teams after a presentation exists, making event progress and incomplete work difficult to monitor.

## Product Decision

Round 2 objective answers remain automatically validated. Judges do not manually approve each answer.

This avoids creating an event-time queue in which teams cannot progress until a judge responds. Manual review can be added later for explicitly subjective question types, but it is outside this design.

Judges review Round 2 results as supporting evidence when evaluating the team's final presentation. They can see what the team was asked, what it selected, and the accepted result, but they cannot alter competition answers.

## Roles and Permissions

### Participants

- Submit Round 2 answers for automatic validation.
- Progress only according to existing round-unlock rules.
- Upload and replace their PowerPoint submission before the configured deadline.
- Access only their own submission history and files.

### Judges

- View every team eligible for judging, including teams that have completed Round 2 but have not uploaded a presentation.
- Review a team's case, Round 2 investigation, and latest PowerPoint submission.
- Download the latest PowerPoint file through an authenticated server route.
- Save their own score as a draft.
- Finalize their own score once.
- Never see or modify another judge's private draft score.

### Administrators

- Monitor submission and judging progress across all teams.
- View every judge's finalized scoring status.
- Reopen a finalized score when correcting an operational mistake.
- Reopening requires explicit confirmation and creates an audit record.

## Team Judging Status

The backend derives a status rather than storing a second source of truth:

1. `round2_incomplete`: the team has not solved every Round 2 question.
2. `awaiting_submission`: Round 2 is complete but no current PowerPoint exists.
3. `ready_to_judge`: a current PowerPoint exists and this judge has no score.
4. `draft_score`: this judge has saved a non-finalized score.
5. `finalized`: this judge has finalized a score.

The judge queue can display all statuses. Scoring is enabled only when a current submission exists. This makes incomplete teams visible without allowing judges to finalize work that is not ready.

## Judge Dashboard

The `/judge` page becomes an operational queue rather than a simple grid of submitted teams.

It includes:

- Team-code search.
- Status filters for incomplete, awaiting submission, ready, draft, and finalized.
- Case title or number when assigned.
- Round 2 completion progress.
- Latest submission filename, version, and upload time when present.
- The current judge's score status and total.
- Summary counts for ready, draft, and finalized teams.

Selecting a team opens `/judge/teams/{team_id}`. The default ordering prioritizes `ready_to_judge`, then `draft_score`, `awaiting_submission`, `round2_incomplete`, and `finalized`.

## Team Review Workspace

The team review page has three focused sections.

### Investigation

For each Round 2 question, show:

- Question category and prompt.
- Options shown to the participant.
- The team's selected answer.
- Whether the answer was accepted.
- Solve timestamp and answering member when available.

The backend must not expose hidden answers for unsolved questions. Completed review data is available to judges only.

### Presentation

Show:

- Current filename.
- Version number.
- File size.
- Upload timestamp.
- Download action.
- Submission history as metadata, with optional authenticated downloads if operationally useful.

The current version is always the version used for judging. If a team replaces its file before the deadline while a judge has a draft, the page warns that a newer version is available and refreshes the displayed metadata. A finalized score remains tied to the submission version that was reviewed.

### Scoring

Keep the existing rubric:

- Problem understanding: 10.
- Technical solution: 20.
- Creativity: 10.
- Presentation: 10.
- Feasibility: 10.
- Total: 60.

Judges can save drafts repeatedly. Finalization requires a confirmation dialog that states the team code, total score, and submission version. Once finalized, the form becomes read-only.

A finalized score stores the reviewed submission ID so later participant uploads cannot silently change the artifact associated with that score.

## Backend Changes

### Judging API

Expand the assigned-team response so it includes all teams that have reached Round 2, their derived judging status, Round 2 progress, optional current submission, and the requesting judge's score summary.

Expand team detail with structured Round 2 question review items instead of only a category-to-correct-answer mapping. The endpoint returns an optional current submission and disables scoring when none exists.

Score finalization validates that:

- A current submission exists.
- Every criterion is within its configured range.
- The computed total matches the criterion sum.
- The score is not already finalized.
- The finalized row records the current submission ID and timestamp.

### Administrative Reopen

Add an admin-only score-reopen endpoint accepting the score identifier and a required reason. It changes `finalized` to false, clears the finalization timestamp, and records who reopened it, when, and why.

### Audit Records

Create a focused audit record for sensitive judging actions:

- Score finalized.
- Score reopened.

Each record includes actor, action, team, score, submission where applicable, timestamp, and structured metadata such as the reopening reason.

## Submission Consistency

Uploads remain versioned and server-managed. Database and file-storage failures must not leave a current submission row pointing to a missing file or accidentally discard the previous current version.

The score-to-submission relationship ensures that judging history remains understandable after replacement uploads.

## Error Handling

- Missing team: `404`.
- Team not ready for scoring: `409` with a clear message.
- Missing stored file: `404` with an operationally useful server log.
- Invalid score range: `422`.
- Attempt to edit a finalized score: `409`.
- Unauthorized role or cross-role access: `403`.
- Reopen without a reason: `422`.

The frontend preserves draft form data after recoverable API failures and provides retry actions for failed team, investigation, and submission loads.

## Testing

Backend tests cover:

- Automatic Round 2 answers require no judge action.
- Judge queue status derivation for every workflow state.
- Hidden answers are not exposed to participants.
- Judges can access completed Round 2 review data.
- Judges cannot score a team without a current submission.
- Draft scores can be updated.
- Finalized scores cannot be edited.
- A finalized score records the reviewed submission.
- One judge cannot modify another judge's score.
- Admin reopening requires a reason and creates an audit record.
- Participant, judge, and admin file downloads enforce role and ownership rules.

Frontend tests cover:

- Queue search, filtering, ordering, and empty states.
- Status rendering for incomplete and ready teams.
- Investigation details and submission metadata.
- Draft save, finalization confirmation, finalized read-only state, and errors.
- Keyboard navigation and accessible labels for filters, score inputs, confirmation, and downloads.

An end-to-end workflow verifies Round 2 completion, PowerPoint upload, judge review, draft save, finalization, admin reopen, judge correction, and refinalization.

## Out of Scope

- Manual approval of objective Round 2 answers.
- Written or free-form Round 2 question types.
- Per-team judge assignment.
- Collaborative scoring between judges.
- In-browser PowerPoint rendering.
- Changing the existing scoring rubric.

## Success Criteria

- Teams never wait for a judge to approve objective Round 2 answers.
- Judges can distinguish incomplete, awaiting-submission, ready, draft, and finalized teams from one queue.
- Judges can review the relevant Round 2 evidence and latest presentation without using admin pages or database access.
- Finalized scores are immutable to judges, recoverable by administrators, and traceable to the reviewed submission version.
- Authorization and workflow tests prevent answer leakage, cross-judge score edits, and unauthorized downloads.
