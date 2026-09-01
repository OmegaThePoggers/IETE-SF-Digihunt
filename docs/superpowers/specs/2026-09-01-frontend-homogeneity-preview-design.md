# DigiHunt Frontend Homogeneity and Preview System Design

## Goal

Turn the recovered `theme/static-page-full` frontend into one coherent event interface whose visual language matches `theming.png`, while preserving the strong landing-page banner and existing information architecture. Add development-only previews for every participant phase so frontend work does not depend on database progression, authentication, WebSockets, or API mutations.

## Design stance

**Aesthetic:** industrial event poster meets operational incident dossier.

The interface should feel like one underground technical event system, not a collection of cyber-themed dashboards. Its recognizable anchor is the combination of KH Interference display typography, near-black fields, acid-lime indexing marks, hard editorial rules, oversized labels, and deliberately uneven compositions.

**DFII assessment:**

- Aesthetic impact: 5/5
- Context fit: 5/5
- Implementation feasibility: 4/5
- Performance safety: 4/5
- Consistency risk: 3/5
- Score: 15/15

The consistency risk is controlled by shared tokens, primitives, shells, and presentation components rather than page-specific styling.

## Reference fidelity

`theming.png` is authoritative for the core identity:

- KH Interference is the principal display face.
- Acid lime is exactly `#C8FF00` for identity-critical accents.
- Near-black is the dominant field.
- Off-white is the primary readable foreground.
- Geometry is square and mechanically cut rather than rounded.
- Lime blocks and pixel markers are used as indexing devices.
- Effects remain restrained. Legibility and hard contrast take priority over glow.

The current landing banner is preserved in structure and treated as the benchmark for the rest of the application. It may receive token-level normalization, responsive corrections, and accessibility fixes, but its composition should not be redesigned without a separate decision.

## Design system

### Color roles

All colors are expressed through CSS variables in `frontend/app/globals.css`:

- `--event-black`: near-black page field.
- `--event-surface`: subtly raised work surface.
- `--event-surface-strong`: emphasized panel surface.
- `--event-white`: warm off-white primary text.
- `--event-gray`: body and secondary text.
- `--event-muted`: metadata and disabled text.
- `--event-lime`: exact `#C8FF00` identity accent.
- `--event-danger`: errors and destructive operations.
- `--event-warning`: waiting and caution states.
- `--event-success`: defaults to lime where meaning remains clear.
- Border variables define faint, standard, and emphasized rules.

Lime should occupy a small visual percentage of most screens. It identifies active state, progression, primary action, or a decisive piece of information. Large full-screen lime treatments are reserved for rare completion moments.

### Typography

- KH Interference Bold: hero text, phase names, major status announcements, and large numeric markers.
- KH Interference Regular/Light: navigation, section labels, buttons, compact headings, and event-oriented body copy where readable.
- JetBrains Mono: codes, timestamps, question metadata, logs, case evidence, technical state, and compact data tables only.

Typography carries hierarchy through size, weight, line length, and positioning. Glow is not used as a substitute for hierarchy.

### Geometry and spacing

- Default radius remains zero.
- Primary page gutters use a shared responsive scale.
- Vertical rhythm uses a limited spacing sequence rather than arbitrary page-local values.
- Panels meet or align through rules where possible instead of appearing as floating cards.
- Important compositions may break the grid through oversized numerals, offset labels, edge-aligned markers, and asymmetric columns.

### Texture and motion

- Retain a very subtle technical grid or grain at page level, never strong enough to interfere with text.
- Use one purposeful entrance treatment for major public-facing screens.
- Interactive motion is limited to focus, hover, progress transitions, and meaningful panel changes.
- Honor `prefers-reduced-motion` and remove all nonessential sequences when enabled.
- Avoid random glitch animation, persistent flicker, floating decoration, and heavy glow.

## Shared frontend architecture

### Foundation layer

Create a small set of theme-aware primitives rather than styling pages independently:

- `EventShell`: global page field, maximum width, texture, responsive gutters.
- `EventHeader`: route identity, phase label, contextual metadata, and navigation actions.
- `SectionMarker`: numeric or textual lime index with hard-rule alignment.
- `EventPanel`: primary, secondary, inset, and danger surface variants.
- `StatusStrip`: locked, active, waiting, solved, error, and informational states.
- `ProgressRail`: shared progression representation for dashboard and phase flows.
- `DataLabel`: consistent label/value treatment for metadata.
- `EventButton`: clear primary, secondary, quiet, and destructive visual hierarchy built on the existing button behavior.
- `EmptyState`, `LoadingState`, and `ErrorState`: consistent full-page and inline feedback.

Existing low-level UI components can remain where behavior is useful, but route code should consume the event primitives rather than raw generic cards and badges.

### Presentation and controller separation

Every backend-driven participant phase is split into:

1. A route/controller that performs authentication, requests, WebSocket subscriptions, polling, navigation, and mutations.
2. A typed presentation component that receives state and callbacks through props.
3. Development fixtures that provide representative state without contacting the backend.

The production route and preview route render the same presentation component. This prevents preview pages from becoming visually inaccurate duplicates.

## Route-specific design

### Landing page

- Preserve the current banner structure, large DigiHunt wordmark, and primary narrative sequence.
- Normalize section markers, rules, button treatments, and mobile spacing against the shared system.
- Reduce any remaining generic card language.
- Keep the page persuasive and poster-like rather than turning it into an application dashboard.

### Registration and login

- Use a shared access shell with asymmetric event branding and a compact functional form area.
- Provide explicit field, validation, loading, success, and denial states.
- Avoid a lone centered generic card.
- Preserve straightforward keyboard order and password-manager support.

### Participant dashboard

- Make this the mission index rather than a dashboard grid.
- Show the team identity, current phase, overall progression, and next required action first.
- Represent rounds as a connected sequence with clear locked, available, active, and complete states.
- Keep team presence and technical metadata secondary.

### Round 1

- Present a sequential clue trail with one dominant active clue.
- Use the shared progress rail, status strip, and phase header.
- Make ownership, teammate activity, answer selection, incorrect feedback, solved state, and access-key completion visually unambiguous.
- Preserve the current sequential behavior and WebSocket-backed collaboration.

### Round 2

- Compose the screen as an incident dossier: evidence index, active evidence surface, investigation questions, and progress trail.
- Logs and code use monospace; narrative evidence uses the primary reading face.
- Remove isolated decorative treatments such as one-off gradients.
- Make completed findings read as an assembled case conclusion rather than generic success cards.

### Master terminal

- Treat this as the highest-pressure transition screen.
- Use a restrained central verification surface, large state typography, and deliberate negative space.
- Clearly distinguish locked, ready, checking, failed, and verified states without decorative terminal filler.

### Round 3

- Compose as a case brief and submission workshop.
- Keep the required presentation structure persistently visible without overwhelming the upload task.
- Distinguish no submission, upload in progress, current submission, replacement history, locked deadline, and upload error states.
- Do not imply that an upload succeeded until the API response confirms it.

### Admin and judge areas

- Share one operational shell and navigation language.
- Use tables, compact status strips, and strongly aligned data rather than marketing-style cards.
- Preserve role distinctions through labels and task hierarchy, not separate visual themes.
- Normalize destructive actions, pending review states, scoring status, team detail headers, and empty states.

## Development-only preview system

### Security and availability

Preview routes are enabled only when:

```env
NEXT_PUBLIC_ENABLE_DEV_PREVIEWS=true
```

Every preview route checks the flag on the server boundary and calls `notFound()` when it is not enabled. Hosting environment templates and production documentation leave this variable unset. Preview routes contain no production secrets and make no API calls.

Because `NEXT_PUBLIC_*` values are embedded into the client bundle, the flag is an availability guard rather than an authorization mechanism. The preview content therefore uses synthetic event data only.

### Route map

- `/dev/preview`: index of previewable pages and states.
- `/dev/preview/dashboard`: participant mission-control states.
- `/dev/preview/round1?state=available|claimed|incorrect|complete`.
- `/dev/preview/round2?state=locked|investigating|complete`.
- `/dev/preview/master?state=locked|ready|failure|success`.
- `/dev/preview/round3?state=locked|empty|uploading|submitted|error`.

Unknown state values fall back to a documented default and display the active fixture name in a development-only toolbar.

### Fixture design

Fixtures are typed against the same view-model interfaces consumed by production presentation components. They include:

- realistic short and long text;
- empty, loading, error, and completion cases;
- teammate ownership and concurrent activity;
- narrow-screen stress content;
- long file names and evidence lines;
- accessibility-relevant labels and statuses.

Callbacks in preview mode update local component state where useful, allowing answer selection, tab changes, upload interaction simulations, and state transitions without real persistence.

### Preview toolbar

A development-only toolbar provides:

- route and fixture name;
- links between phase previews;
- state selector;
- viewport reminders;
- reduced-motion toggle or instructions;
- reset action for local preview state.

It must remain visually separate from the production presentation so screenshots can hide it easily.

## Error, loading, and empty states

All routes explicitly support:

- initial loading;
- slow refresh while retaining prior data;
- authentication failure;
- authorization/round lock;
- empty result;
- recoverable API failure with retry;
- mutation in progress;
- mutation failure;
- completed state.

Errors use clear human-readable messages while preserving useful technical context when appropriate. Loading should not cause major layout jumps. Locked states explain the next required action rather than only denying access.

## Accessibility and responsiveness

- Maintain WCAG AA contrast for body text, controls, and focus states.
- Do not rely on lime alone to communicate status. Pair color with text, shape, or iconography.
- Use visible `:focus-visible` treatments consistent with the hard-rule visual system.
- Ensure all phase interactions work by keyboard.
- Announce asynchronous answer, upload, and verification outcomes through appropriate live regions.
- Test at 320px, 375px, 768px, 1024px, 1440px, and a tall desktop viewport.
- Allow evidence, logs, tables, and long codes to wrap or scroll without breaking the page.
- Honor reduced motion.

## Testing strategy

### Static quality

- TypeScript compilation and Next.js production build.
- ESLint with the inherited four React lint errors repaired rather than suppressed broadly.
- Automated checks that preview route states map to valid typed fixtures.

### Component and interaction tests

Add a frontend test stack appropriate to Next.js and React, covering:

- shared primitive variants;
- phase presentation rendering for every fixture state;
- keyboard interaction and focus behavior;
- answer, evidence-tab, master-code, and upload state transitions;
- preview guards when the environment flag is absent;
- accessible labels and live feedback.

### Visual regression

Capture deterministic screenshots of the fixture routes at desktop and mobile widths. Compare landing, access, dashboard, all phase states, admin, and judge critical paths. Treat `theming.png` as the palette/type identity reference and the preserved banner as the internal composition benchmark.

### Real integration verification

After presentation work passes fixtures, run the real FastAPI/PostgreSQL application and verify registration, login, dashboard, Round 1 collaboration, Round 2 evidence, Master transition, Round 3 upload, judge review, and admin views. Fixture success is not a substitute for real API and WebSocket acceptance testing.

## Implementation sequence

1. Inventory screenshots, current tokens, repeated patterns, and responsive failures.
2. Establish exact theme tokens, typography roles, focus rules, texture, and motion constraints.
3. Build shared event primitives and document their intended use.
4. Refactor login, registration, and dashboard to validate the system on simple and medium-complexity screens.
5. Extract Round 1 presentation and add typed fixtures/previews.
6. Extract Round 2 presentation and add dossier fixtures/previews.
7. Extract Master presentation and add transition fixtures/previews.
8. Extract Round 3 presentation and add submission fixtures/previews.
9. Normalize landing-page sections without replacing the banner.
10. Normalize admin and judge shells, tables, states, and actions.
11. Add automated interaction, accessibility, and visual-regression coverage.
12. Run real frontend/backend acceptance tests and fix discrepancies.

## Scope boundaries

Included:

- visual system and route homogeneity;
- preserved landing banner;
- participant, judge, and admin frontend surfaces;
- development-only fixture previews;
- responsive, accessibility, lint, component, visual, and integration verification.

Excluded unless separately approved:

- backend round-rule changes;
- API schema redesign;
- event content rewrites beyond clarity corrections;
- replacement of the landing banner composition;
- production demo bypasses or authentication shortcuts;
- deployment-provider configuration.

## Completion criteria

- Every frontend route looks recognizably part of the same event system.
- The identity accurately uses KH Interference, near-black, off-white, and exact `#C8FF00` lime from `theming.png`.
- The banner remains intact and serves as the application-wide benchmark.
- No phase requires backend progression for visual development or state inspection.
- Preview routes are unavailable unless explicitly enabled and use synthetic data only.
- Production routes still use real APIs, auth, polling, and WebSockets.
- All routes pass build, lint, accessibility, responsive, visual-regression, and real integration checks.
