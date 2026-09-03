# Production Hardening and Event Readiness Plan

Target: 200 concurrent users on an old Windows 10 laptop, behind Cloudflare Tunnel.
Constraints: no regressions, all event data persistent and reachable from the server filesystem, 1GB PPT uploads, working judge flow, no injection surface.

Work is ordered by risk. Phases 1-2 are event-breaking bugs. Phases 3-6 are the requested features. Phase 7 is verification.

---

## Phase 1 — Fix client IP attribution (event-breaking)

**Problem.** Behind `cloudflared`, every request reaches nginx from the tunnel container's IP. `limit_req_zone $binary_remote_addr` therefore collapses all 200 users into a single bucket. `auth_limit` is `5r/m`, so the sixth login of the whole event gets a 429. The backend limiter repeats the bug via `request.client.host`.

**Changes.**

1. `deploy/nginx/nginx.conf`
   - Add a real-IP map. Cloudflare sets `CF-Connecting-IP`:
     ```nginx
     map $http_cf_connecting_ip $client_ip {
       default   $http_cf_connecting_ip;
       ""        $remote_addr;
     }
     ```
   - Key both zones on `$client_ip`, not `$binary_remote_addr`.
   - Set `proxy_set_header X-Forwarded-For $client_ip;` so the backend sees one trustworthy value rather than an appendable chain.
2. Raise limits for real event load. 200 users polling a board is normal traffic, not abuse:
   - `api_limit`: `30r/s` -> `50r/s`, burst 100.
   - `auth_limit`: `5r/m` -> `20r/m` per IP, burst 10. Teams share NAT at a venue, so per-IP login limits must tolerate a whole room behind one address.
   - `limit_conn conn_limit 30` -> `100`. Each user holds one WebSocket plus normal requests.
3. `backend/app/core/rate_limit.py`
   - Read the client IP from `X-Forwarded-For` (first hop) when present, else `request.client.host`.
   - Only trust that header when `settings.is_production` is true, so local dev cannot be spoofed into a wrong bucket.
   - Raise `DEFAULT_LIMIT` 60 -> 240/min. With a WebSocket-driven UI, a user still issues bursts on navigation.
   - Add memory bounding: the `_hits` dict currently grows one entry per `(ip, path)` forever. Add opportunistic eviction of empty deques every N requests. Unbounded growth over a multi-hour event on a low-RAM laptop is a real leak.

**Tests.** `backend/tests/test_rate_limit.py`
- Forwarded IPs get independent buckets in production mode.
- The header is ignored in development mode.
- Empty buckets are evicted.

---

## Phase 2 — Stream uploads to disk, raise limit to 1GB (event-breaking)

**Problem.** `submissions.py` accumulates `chunks: list[bytes]` and then joins them. A 1GB upload needs ~2GB of RAM at the join. On an old laptop with several concurrent uploads this OOM-kills the backend.

**Changes.**

1. `backend/app/routers/submissions.py`
   - Write each chunk directly to a `tempfile.NamedTemporaryFile(delete=False)` created inside `ppt_directory`, so the final move is a same-filesystem rename and never a cross-device copy.
   - Track `total` while writing. On overflow, close and unlink the temp file, then 413.
   - On success, `os.replace(tmp, dest_path)`.
   - On any exception, unlink the temp file. Use `try/finally` so a failed upload never leaves an orphan.
   - Keep the existing extension, MIME, and path-containment checks exactly as they are. They are already correct.
   - `MAX_UPLOAD_BYTES` becomes `settings.max_upload_bytes`, defaulting to `1024 * 1024 * 1024`.
   - Change the oversize status from 400 to 413, and make the message use the configured limit rather than a hardcoded "50MB".
2. `backend/app/core/config.py`: add `max_upload_bytes: int = 1073741824`.
3. `deploy/nginx/nginx.conf`
   - `client_max_body_size 1200m` (headroom above 1GB for multipart overhead).
   - `/api/submissions` already sets `proxy_request_buffering off`, which is correct and required. Keep it, and raise read/send timeouts to 30m for slow venue uplinks.
4. Frontend: update any hardcoded "50MB" copy to "1GB".

**Note on Cloudflare.** Free and Pro plans cap upload body size at 100MB. This is a hard external limit that no server-side change can lift. The plan documents it and provides the mitigation: for the presentation round, either require files under 100MB, or have teams upload while on the venue LAN directly to the laptop's nginx port. This must be decided before event day; the deployment doc will state it explicitly rather than letting it surprise you live.

**Tests.** `backend/tests/test_submissions_upload.py`
- Oversize upload returns 413 and leaves no file behind.
- Successful upload writes a file and one Submission row.
- Temp files are cleaned up on failure.
- Path traversal in filename still cannot escape `ppt_directory`.

---

## Phase 3 — Persistent, server-accessible data

**Goal.** Emails, password hashes, PPTs, and scores survive restarts and are directly reachable on the laptop's filesystem.

**Changes.**

1. `compose.production.yaml`: replace named volumes with bind mounts.
   - `./data/postgres:/var/lib/postgresql/data`
   - `./data/ppts:/data/ppts`
   - `./data/uploads:/data/uploads`
   Bind mounts make PPTs directly browsable from WSL and from Windows via `\\wsl$`. This is what "accessible on the server side" requires.
2. Add `data/` to `.gitignore`. Event data must never be committed.
3. Document the ownership requirement: the backend runs as uid 10001, so `./data/ppts` and `./data/uploads` need `chown 10001:10001`. Postgres runs as uid 999. Getting this wrong is the single most likely first-boot failure, so the deployment doc gets an explicit `mkdir` + `chown` step.
4. Backup scripts move from `docker run -v <volume>` to plain `tar` over `./data/ppts`, which is simpler and faster.

**Verification.** Restart the whole stack and confirm teams, users, and submissions all persist.

---

## Phase 4 — Admin CLI for accounts and password reset

**Goal.** Create judge and admin accounts, and recover a forgotten team password, without exposing any privileged HTTP route.

**New file.** `backend/app/cli.py`, invoked as `python -m app.cli <command>`.

Commands:

| Command | Behavior |
|---|---|
| `create-user --role admin\|judge --name N --email E` | Generates a strong random password, prints it once, creates the user. Refuses duplicate emails. |
| `reset-password --email E` | Generates a new password, prints once, updates the hash. Works for any role. |
| `reset-team-password --team-code T` | Resets the shared password for every member of one team. This is the forgotten-password path for participants. |
| `list-users` | Prints email, role, team code, last login. Never prints hashes. |

Design rules:
- Passwords are generated with `secrets.token_urlsafe(12)`, never chosen on the command line, so they cannot leak into shell history.
- Output goes to stdout once and is never persisted.
- Every reset writes a line to the app log with the actor, target email, and timestamp. Password resets on a live event system must leave a trail.
- The CLI reuses `hash_password` and the existing session factory. No parallel auth logic.

**Why not an HTTP route.** An admin-only reset endpoint is one JWT leak away from a full account takeover. A CLI requires shell access to the laptop, which is a much stronger boundary for a one-day event.

**Tests.** `backend/tests/test_cli.py`
- `create-user` creates exactly one user with the requested role.
- Duplicate email is rejected.
- `reset-password` changes the hash, and the new password verifies.
- `reset-team-password` updates every member of the team and nobody outside it.

---

## Phase 5 — Concurrency tuning for 200 users

**Constraint that shapes everything.** `websocket/manager.py` and `rate_limit.py` both hold state in process memory. Running `uvicorn --workers N` would give each worker a partial view of connected sockets, so broadcasts would reach only the fraction of a team connected to that worker. **The backend must stay at one worker.** The plan therefore optimizes the single process rather than scaling out. This is a deliberate, documented trade, not an oversight.

Is one worker enough? Yes, for this workload. Requests are small ORM reads and writes, and the heavy path is WebSocket fan-out, which is IO-bound and handled well by the event loop. The realistic bottleneck is the database pool, not CPU.

**Changes.**

1. `backend/app/core/db.py` — pool sizing, currently defaults (5 + 10 overflow):
   ```python
   create_engine(
       settings.database_url,
       pool_size=20,
       max_overflow=20,
       pool_timeout=10,
       pool_recycle=1800,
       pool_pre_ping=True,
   )
   ```
   `pool_pre_ping` matters because a laptop that sleeps or drops its network will otherwise hand out dead connections after resume.
2. Postgres tuning for a low-RAM laptop, via compose `command`:
   `max_connections=100`, `shared_buffers=256MB`, `work_mem=8MB`, `effective_cache_size=768MB`.
   Pool ceiling is 40, well under `max_connections`, leaving headroom for migrations, CLI, and psql.
3. Add container memory limits so one runaway service cannot freeze Windows: db 1g, backend 1g, frontend 512m, nginx 128m.
4. nginx: raise `worker_connections` 1024 -> 4096. Each user needs a WebSocket plus HTTP connections, and nginx holds both the client and the upstream side.
5. Password hashing is the one real CPU cost. Argon2's default profile is deliberately slow. With 200 users logging in near-simultaneously this serializes badly on old hardware. Lower to an explicit, still-safe profile: `time_cost=2, memory_cost=65536 (64MB), parallelism=1`. Note that existing hashes remain verifiable, since Argon2 encodes its parameters in the hash string, so this change is backward compatible.

**Load test.** `scripts/loadtest.py`, standard library only, no new dependency:
- Registers N synthetic teams.
- Logs in concurrently, holds WebSockets open, polls boards, answers questions.
- Reports p50/p95/p99 latency and error rate.
- Run at 50, then 200, then 250 to find the actual knee.
- Acceptance: at 200 concurrent, zero 5xx, zero unintended 429, p95 under 1s.

---

## Phase 6 — Security hardening

**SQL injection.** Already safe. Every query goes through SQLAlchemy ORM constructs with bound parameters; there is no string-built SQL, no `text()`, no f-string interpolation into queries anywhere in `backend/app`. Rather than change working code, add a regression guard so this cannot silently rot:
- `backend/tests/test_no_raw_sql.py` scans `backend/app` and fails on `text(`, `.execute("`, or f-strings containing `SELECT`/`INSERT`/`UPDATE`/`DELETE`.
- Add injection-payload tests against login and registration asserting normal auth failure rather than a 500.

**Other items.**

1. Login currently leaks a timing signal: a missing email returns before any hash verification, while a real email pays full Argon2 cost. That difference lets an attacker enumerate registered emails. Fix by verifying against a dummy hash when the user is absent, so both paths take comparable time.
2. `Strict-Transport-Security` is missing from the nginx header set. Add `max-age=31536000; includeSubDomains`.
3. CSP currently allows `'unsafe-eval'`. Verify whether the production Next.js build actually needs it; drop it if not. Do not break the app to win a lint point, so this is verify-then-remove, not remove-blindly.
4. Confirm `ENABLE_API_DOCS=false` in production, which the compose file already sets.
5. Add `/api/auth/register-team` to a dedicated stricter nginx limit zone. Registration is the one unauthenticated write endpoint and the most attractive spam target.
6. Verify the WebSocket route authenticates via JWT before joining a team room, and that a token for team A can never subscribe to team B.
7. Add a `.dockerignore` audit so no secret or `data/` content can enter a build context.

---

## Phase 7 — End-to-end verification

**Automated.** `scripts/smoke_prod.py` runs the full event path against a live stack:
register team, login, solve round 1, unlock gate 2, solve round 2, gate 3, round 3, gate 4, upload PPT, download own PPT, verify cross-team download is 403, judge login, judge list, judge download, judge score, judge finalize, verify finalized score is immutable, admin dashboard, admin submission list.

Any non-green step fails the run. This is the acceptance test for "don't break anything".

**Manual, on the event laptop.**
- Reboot the laptop, confirm the stack self-starts and all data survives.
- Upload a large PPT over real venue Wi-Fi.
- Confirm PPT files are visible in `./data/ppts` from Windows Explorer.
- Run each CLI command once.
- Take a backup and rehearse a restore into a scratch stack.

---

## Phase 8 — Documentation

1. Rewrite `docs/DEPLOY_WINDOWS_11_CLOUDFLARE.md` as `docs/DEPLOY_WINDOWS_CLOUDFLARE.md`, covering Windows 10 and 11:
   - Windows 10 requires build 19044 or later for WSL 2 with systemd support. Add the version check up front.
   - Add `.wslconfig` with an explicit memory and processor cap. Without it, WSL 2 on Windows 10 will happily consume most of RAM and stall the host mid-event.
   - Add the `mkdir` and `chown` steps for bind-mounted data directories.
   - Add the Cloudflare 100MB upload cap and its mitigation.
   - Add power settings: disable sleep, disable hibernate, disable USB selective suspend, disable fast startup.
   - Add a pre-event load-test step.
2. Update `docs/OPERATIONS.md`: CLI account commands, bind-mount backup and restore, the one-worker constraint and why, and a rollback procedure.
3. Add `docs/EVENT_DAY_RUNBOOK.md`: a timed checklist for T-24h, T-1h, during, and after the event, including what to do when a team forgets its password mid-round.

---

## Execution order

Phases 1 and 2 first, since they are live-event failures. Then 3 and 4, which are the requested features. Then 5, measured with the load test rather than guessed. Then 6, 7, and 8.

Each phase is committed separately with its tests green, so any single phase can be reverted without unwinding the others.

## Risk register

| Risk | Mitigation |
|---|---|
| Cloudflare 100MB body cap blocks 1GB uploads | Decide before event day: cap files at 100MB, or accept LAN-direct uploads |
| Bind-mount ownership wrong on first boot | Explicit `chown` step in the deployment doc, verified during rehearsal |
| Argon2 retune weakens hashes | Stay at 64MB memory cost, which remains above OWASP's minimum guidance |
| Load test reveals a knee below 200 | Tune the pool and Postgres first; the frontend is static and cacheable, so the backend is the only real lever |
| Laptop sleeps mid-event | Power settings plus `pool_pre_ping` for connection recovery |
