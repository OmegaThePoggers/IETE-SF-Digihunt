# Event-Day Cloudflare + LAN Backup Deployment

This is the current same-day deployment runbook. It supersedes the older Oracle/Windows migration plans for today's event.

## Access model

- Primary: Cloudflare Tunnel when available.
- Backup: LAN-direct to nginx on the same stack, or home router port-forward if participants are remote.
- Do not migrate hosts on event day.

## Start or update

```bash
alias dprod='docker compose --env-file .env.production -f compose.production.yaml'
dprod up --build -d
dprod ps
```

## Required production data directories

Production uses bind mounts, not anonymous Docker volumes, so data is visible on the server and survives container rebuilds.

```bash
mkdir -p data/{postgres,ppts,uploads} backups
sudo chown -R 999:999 data/postgres
sudo chown -R 10001:10001 data/ppts data/uploads
```

Data locations:

| Data | Server path |
|---|---|
| PostgreSQL DB, including emails and password hashes | `./data/postgres` |
| PPT submissions | `./data/ppts` |
| Legacy/general uploads | `./data/uploads` |

Never commit `data/`. It is ignored by git.

## Secrets

```bash
mkdir -p secrets
openssl rand -base64 32 > secrets/postgres_password.txt
openssl rand -base64 64 > secrets/jwt_secret.txt
printf 'PASTE_CLOUDFLARE_TUNNEL_TOKEN_HERE' > secrets/cloudflared_token.txt
chmod 600 secrets/*.txt
```

`.env.production` minimum:

```env
PUBLIC_HOSTNAME=hunt.yourdomain.com
POSTGRES_DB=digihunt
POSTGRES_USER=digihunt
ACCESS_TOKEN_EXPIRE_MINUTES=480
MAX_UPLOAD_BYTES=1073741824
```

## Account CLI

Run on the server:

```bash
dprod exec backend python -m app.cli create-user --role admin --name "Admin" --email admin@example.com
dprod exec backend python -m app.cli create-user --role judge --name "Judge 1" --email judge1@example.com
dprod exec backend python -m app.cli list-users
```

Forgotten password:

```bash
# One user
dprod exec backend python -m app.cli reset-password --email user@example.com

# Whole participant team, shared password
dprod exec backend python -m app.cli reset-team-password --team-code DGH-001
```

The generated password is printed once. Copy it immediately.

## 1GB PPT uploads

Backend streams uploads to disk and allows 1GB by default. nginx allows 1200MB for multipart overhead.

Cloudflare free/proxy paths may still cap request bodies at 100MB. If a team has a larger PPT, use LAN-direct or port-forward backup for that upload.

## LAN backup

If participants are physically with the server:

1. Publish nginx on port 80 if not already published.
2. Give the server a fixed LAN IP.
3. Allow inbound TCP 80 on the local firewall for private network only.
4. Test from a phone on the same WiFi.
5. Share `http://<server-lan-ip>` if Cloudflare fails.

If participants are remote, use home/router port forwarding to TCP 80 instead. We confirmed your connection does not look like CGNAT, so this is viable.

## Backup

```bash
stamp=$(date +%Y%m%d-%H%M%S)
dprod exec -T db pg_dump -U digihunt digihunt > backups/db-$stamp.sql
tar -czf backups/ppts-$stamp.tar.gz -C data/ppts .
```

Take one backup after registration closes and one after all PPTs are uploaded.

## Health checks

```bash
dprod ps
dprod logs --tail=100 backend nginx cloudflared
dprod exec backend python -m app.cli list-users | head
curl -I https://$PUBLIC_HOSTNAME
```

## Do not do during the event

- Do not run `dprod down --volumes`.
- Do not migrate to Oracle or any new VPS.
- Do not deploy non-critical changes.
- Do not run demo seed on production.
