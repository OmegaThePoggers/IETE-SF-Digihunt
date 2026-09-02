# Production Operations Runbook

Use this with `docs/DEPLOY_WINDOWS_11_CLOUDFLARE.md`.

## Commands

Set this shell alias on the deployment laptop:

```bash
alias dprod='docker compose --env-file .env.production -f compose.production.yaml'
```

Start or update:

```bash
dprod up --build -d
```

Status:

```bash
dprod ps
dprod logs -f nginx backend cloudflared
```

Stop while preserving data:

```bash
dprod down
```

Never use this during or after the event unless you intentionally want to delete the database and uploaded files:

```bash
dprod down --volumes
```

## Health checks

From the laptop:

```bash
dprod exec nginx wget -qO- http://127.0.0.1/healthz
dprod exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
```

From outside the laptop, test on mobile data:

```text
https://hunt.yourdomain.com
```

## Backup

```bash
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
dprod exec -T db pg_dump -U digihunt digihunt > backups/digihunt-$stamp.sql
docker run --rm -v digihunt-prod_ppt_data:/ppts:ro -v "$PWD/backups:/backups" alpine tar -czf /backups/ppts-$stamp.tar.gz -C /ppts .
```

## Restore rehearsal

Run this only on a disposable test stack or after intentionally stopping production.

```bash
cat backups/digihunt-YYYYMMDD-HHMMSS.sql | dprod exec -T db psql -U digihunt digihunt
```

## Rollback code

```bash
git log --oneline -5
git checkout <known-good-commit>
dprod up --build -d
```

After the event, return to main:

```bash
git checkout main
git pull origin main
```

## Emergency checklist

1. Check power and internet.
2. Check Docker Desktop is running.
3. Run `dprod ps`.
4. Restart only the failing service if needed:

```bash
dprod restart nginx
# or
dprod restart backend
# or
dprod restart cloudflared
```

5. If Cloudflare is unhealthy, open Cloudflare Zero Trust → Tunnels and confirm the tunnel is connected.
6. If the laptop rebooted, open Ubuntu and run `dprod up -d` from the repo.
