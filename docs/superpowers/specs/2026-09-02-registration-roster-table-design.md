# Registration roster table design

**Date:** 2026-09-02

## Goal

Replace the visually fragmented participant roster with one concise horizontal row per participant, without changing registration behavior for teams of one to four people.

## Chosen approach

Each participant is a single responsive row with three visual columns on desktop:

1. A compact ordinal chip, for example `01`.
2. A full-name field.
3. An email-address field.

The panel header remains `Participant details` with the selected-team count. Repeated `Participant 01` text is removed because the ordinal chip supplies the same context without forcing a second line.

On narrow screens, the ordinal remains at the start of the row and the two inputs stack beneath it. This preserves readability and avoids overflow.

## Constraints

- Keep the existing 1–4 participant selector and its ability to resize the roster.
- Preserve field names, browser autocomplete, accessible labels, validation, form payload, and submission behavior.
- Keep the existing dark event visual language and primary accent, with less visual noise.

## Validation

- Update the UI test to assert that each participant is rendered as one named row.
- Run the frontend test suite, lint, and production build.
- Rebuild the Docker deployment, smoke-test `/register`, commit, and push the change.
