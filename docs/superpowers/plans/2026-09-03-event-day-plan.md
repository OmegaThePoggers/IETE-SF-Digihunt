# Event Day Plan (event is TODAY)

Supersedes `2026-09-03-production-hardening.md` and `2026-09-03-oracle-vm-hosting.md`. Those assumed days of lead time. This one assumes hours.

**Primary access:** existing Cloudflare Tunnel, unchanged. It already works.
**Backup access:** LAN-direct on the same stack, switched by DNS if the tunnel fails or a PPT exceeds 100MB.

Scope rule for today: fix only what breaks the event. Everything else waits.

---

## Part 1 — Code fixes (do these first, ~90 min)

### 1.1 Rate limiting (event-breaking, do first)

Behind `cloudflared`, every request reaches nginx from the tunnel container's IP, so `limit_req_zone $binary_remote_addr` puts all 200 users in one bucket. `auth_limit` is `5r/m`, so roughly the sixth login of the entire event gets a 429. This will stop registration within minutes of opening.

`deploy/nginx/nginx.conf`:
- Add a map keying on `CF-Connecting-IP`, falling back to `$remote_addr` so LAN mode still works:
  ```nginx
  map $http_cf_connecting_ip $client_ip {
    default $http_cf_connecting_ip;
    ''      $remote_addr;
  }
  ```
- Point all three zones at `$client_ip`.
- Raise limits for real load: `api_limit` 30r/s to 50r/s burst 100, `auth_limit` 5r/m to 20r/m, `limit_conn` 30 to 100. A venue shares one NAT address, so per-IP login limits must tolerate a whole room.
- `worker_connections` 1024 to 4096, since each user holds a WebSocket plus HTTP.
- Send `X-Real-IP` and `X-Forwarded-For` as `$client_ip` rather than an appendable chain.

`backend/app/core/rate_limit.py`:
- Read the client IP from `X-Forwarded-For` when `settings.is_production`, else `request.client.host`. Trusting the header only in production keeps local dev unspoofable.
- Raise `DEFAULT_LIMIT` 60 to 240 per minute.

Verify: `nginx -t` inside the container, then two different `CF-Connecting-IP` values get independent buckets.

### 1.2 Upload streaming and 1GB limit (event-breaking)

`submissions.py` builds `chunks: list[bytes]` then joins, so a 1GB upload needs about 2GB RAM at the join and OOM-kills the backend.

- Stream chunks to `tempfile.NamedTemporaryFile(delete=False)` created inside `ppt_directory`, so the final `os.replace` is a same-filesystem rename.
- Track running total, and on overflow close, unlink, and return 413.
- `try/finally` unlink so a failed upload never orphans a temp file.
- `MAX_UPLOAD_BYTES` becomes `settings.max_upload_bytes`, default 1GB.
- Keep the existing extension, MIME, and path-containment checks exactly as they are. They are already correct.
- nginx: `client_max_body_size` 50m to 1200m, upload timeouts to 30m.
- Update frontend copy from 50MB to 1GB.

**Cloudflare caps request bodies at 100MB on free and Pro plans.** No server change lifts this. Either tell teams to keep PPTs under 100MB, which is ample for slides, or route large uploads over the LAN backup in Part 2.

### 1.3 Admin and judge CLI

`backend/app/cli.py`, run as `python -m app.cli`:

| Command | Purpose |
|---|---|
| `create-user --role admin\|judge --name N --email E` | Generates a random password, prints once |
| `reset-password --email E` | Forgotten-password path for any account |
| `reset-team-password --team-code T` | Resets the shared password for one team |
| `list-users` | Email, role, team, last login. Never hashes |

Passwords come from `secrets.token_urlsafe(12)`, never from argv, so they stay out of shell history. Reuses `hash_password` and the existing session factory, so there is no parallel auth logic. No HTTP route, because a privileged reset endpoint is one JWT leak from account takeover.

### 1.4 Persistence and server-side access

`compose.production.yaml`: replace named volumes with bind mounts to `./data/postgres`, `./data/ppts`, `./data/uploads`. This is what makes PPTs directly browsable on the server.

**Ownership is the most likely first-boot failure.** Backend runs as uid 10001, Postgres as 999:
```bash
mkdir -p data/{postgres,ppts,uploads}
sudo chown -R 10001:10001 data/ppts data/uploads
sudo chown -R 999:999 data/postgres
```

Add `data/` to `.gitignore`.

**Migrating existing volume data** if teams are already registered:
```bash
docker run --rm -v digihunt-prod_ppt_data:/from -v "$PWD/data/ppts:/to" alpine cp -a /from/. /to/
```
Otherwise start from an empty database, which is fine if no real teams exist yet.

### 1.5 Skip today

Argon2 retuning, Postgres tuning, container memory limits, CSP tightening, login timing fix, and the load test. All are real improvements, none is event-breaking, and each is a chance to break something an hour before go-live. SQL injection needs no work, since every query already uses SQLAlchemy bound parameters with no string-built SQL anywhere in `backend/app`.

---

## Part 2 — LAN backup access (~20 min)

Purpose: keep running if college WiFi blocks the tunnel, and lift the 100MB cap for large PPTs. Same stack, second path, no duplicate deployment.

1. Publish nginx on the host: add `ports: ["80:80"]` to the nginx service. The tunnel keeps working, and this only adds a second way in.
2. Give the laptop a static LAN IP, either a DHCP reservation on the router or a static config.
3. Allow inbound port 80 in Windows Firewall for the private network only.
4. Add the LAN IP to `CORS_ORIGINS` so browsers accept it.
5. Test from a phone on the same network before the event starts.

**Deciding factor: are participants physically with the laptop?**
- Same network: LAN works and is the better path, being faster with no caps.
- Different location: LAN is unusable, so port forwarding on the home router is the fallback. Your connection has a real public IP with no CGNAT, verified by traceroute, so forwarding will work. Pair it with DuckDNS for a stable hostname.

**Switching during the event:** change the DNS record to the LAN or public IP. Keep both paths tested beforehand so the switch is a DNS edit, not a debugging session.

---

## Part 3 — Verification before going live

Run the full path against the real stack, not localhost:

register team, login, solve round 1, gate 2, round 2, gate 3, round 3, gate 4, upload PPT, download own PPT, confirm cross-team download returns 403, judge login, judge list, judge download, judge score, judge finalize, confirm finalized score is immutable, admin dashboard, admin submission list.

Then:
- Restart the whole stack and confirm all data survives.
- Confirm PPTs appear in `./data/ppts` on the server.
- Run each CLI command once, including a password reset.
- Take a backup: `pg_dump` plus `tar` of `data/ppts`.
- Load the site from a phone on mobile data.

Backup command with bind mounts:
```bash
stamp=$(date +%Y%m%d-%H%M%S)
dprod exec -T db pg_dump -U digihunt digihunt > backups/db-$stamp.sql
tar -czf backups/ppts-$stamp.tar.gz -C data/ppts .
```

---

## Order of work

1. Rate limiting, since the event dies without it
2. Upload streaming, since it OOMs on large files
3. CLI, needed for judge accounts and password resets
4. Bind mounts, needed for persistence and server-side access
5. Full test suite, then deploy, then verify
6. LAN backup if time allows

Commit each step separately so any one can be reverted alone.

## During the event

- Do not deploy anything unless something is actively broken.
- Team forgot its password: `python -m app.cli reset-team-password --team-code XXX`.
- Tunnel dies: switch DNS to the LAN or public IP.
- Backend unhealthy: `dprod restart backend`. Data lives in bind mounts and survives.
- Take a backup after registration closes and again after round 4 uploads.
