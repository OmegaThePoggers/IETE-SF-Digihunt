# Public Hosting Plan: Oracle Cloud Always Free VM

Replaces the Windows laptop + Cloudflare Tunnel deployment. The entire stack moves to a permanently free Oracle Cloud VM with a real public IP.

## Why this replaces the laptop

| Problem with laptop + Cloudflare Tunnel | Resolved by |
|---|---|
| College WiFi blocks/degrades tunnel traffic | Ordinary HTTPS on a normal domain and a real IP |
| Cloudflare free plan caps request bodies at 100MB | No proxy in the path, so the 1GB PPT requirement works |
| Home upload bandwidth is the ceiling for 200 users | VM has datacenter uplink and 10TB/month egress |
| Laptop sleep, WSL 2 memory tuning, Docker Desktop | Plain Ubuntu, no WSL layer |
| Old laptop hardware | 2 ARM cores, 12GB RAM, dedicated |

The stack is already fully Dockerized, so the migration is a `git clone` plus `docker compose up` on the VM. No application code changes are required for the move itself.

## Gate 0 — Provision the VM before anything else

Everything below depends on this, so do it first and do not begin the hardening phases until it succeeds.

1. Create an Oracle Cloud account. A credit card is required for identity verification, but Always Free resources are never charged. Choose the home region nearest you (Mumbai or Hyderabad for India), because the home region cannot be changed later.
2. Create a VM instance:
   - Shape: `VM.Standard.A1.Flex` (Ampere ARM, Always Free eligible)
   - OCPUs 2, memory 12GB, which is the current Always Free ceiling
   - Image: Canonical Ubuntu 24.04
   - Boot volume 100GB, well within the 200GB free allowance and generous for 1GB PPT uploads
   - Save the SSH private key at creation. It cannot be downloaded again.
3. Open ports 80 and 443:
   - VCN security list: add ingress rules for TCP 80 and 443 from `0.0.0.0/0`
   - On the VM itself, Oracle's Ubuntu images ship restrictive iptables rules, so also run `sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT`, the same for 443, then persist with `netfilter-persistent save`. **Forgetting the host firewall is the single most common Oracle Cloud failure**, and it looks exactly like a broken app.
4. Reserve a static public IP so it survives a VM restart.

### Known risks at this gate

- **ARM capacity errors.** "Out of host capacity" is common in busy regions. Retry over several days, or try a different availability domain. Start this at least a week before the event.
- **Card rejection.** Some Indian cards are declined at signup. If this happens, fall back to the plan below.

### Fallback if Oracle signup fails

Your home connection has a real public IP (verified: no CGNAT, hop 2 is in your ISP's public range), so port forwarding is viable:

- Forward router ports 80 and 443 to the laptop
- Use DuckDNS for a free hostname with dynamic IP updates
- Let's Encrypt via HTTP-01 for TLS
- Accept that home upload bandwidth limits concurrent PPT downloads

This is strictly worse than the VM, but it works and needs no third party approval.

## Phase A — Deploy the stack on the VM

1. Install Docker Engine and the compose plugin from Docker's official apt repository. Do not use Docker Desktop, which is not applicable on a headless server.
2. Clone the repository and create `.env.production` plus the `secrets/` files exactly as the current deployment doc describes, minus the Cloudflare token.
3. Create bind-mounted data directories with correct ownership, per Phase 3 of the hardening plan. On plain Linux this is straightforward, with none of the WSL ownership complications.
4. **ARM image verification.** Every base image the project uses publishes an `arm64` variant: `python:3.12-slim-bookworm`, `node:22-bookworm-slim`, `postgres:17-alpine`, `nginx:1.29-alpine`, and `ghcr.io/astral-sh/uv`. No Dockerfile changes are expected, but the first build on the VM is the test that proves it. Build early, not on event day.

## Phase B — Replace cloudflared with direct TLS

1. Remove the `cloudflared` service and its secret from `compose.production.yaml`. Remove the `edge` network indirection, since nginx now faces the internet directly.
2. Publish nginx on host ports 80 and 443.
3. Add TLS termination in nginx using Let's Encrypt:
   - Add a `certbot` service sharing a webroot volume with nginx
   - Serve `/.well-known/acme-challenge/` from that webroot over port 80
   - Redirect all other port 80 traffic to 443
   - Certbot renews automatically; certificates last 90 days, so a single issuance covers the event comfortably
4. DNS: point an `A` record at the VM's reserved public IP.
   - If the domain is on Cloudflare, **set the record to DNS-only (grey cloud), not proxied**. Proxying would reintroduce the 100MB body cap that motivated this whole migration.
5. Update `CORS_ORIGINS` and `PUBLIC_HOSTNAME` to the new hostname.

### Effect on the hardening plan

Phase 1's real-IP handling still applies, unchanged. The `map` already falls back to `$remote_addr` when `CF-Connecting-IP` is absent, which is exactly the direct-serving case. Nothing to redo.

Phase 2's 1GB limit becomes fully achievable, and the "Cloudflare 100MB cap" risk is removed from the register.

## Phase C — Capacity on 2 ARM cores

The VM is stronger than the laptop but not unlimited, so the tuning targets shift.

1. Backend stays at **one uvicorn worker**, for the same reason as before: the WebSocket manager and rate limiter hold per-process state, so multiple workers would split team broadcasts.
2. Container memory limits for a 12GB host: db 3g, backend 2g, frontend 1g, nginx 256m. Far more headroom than the laptop allowed.
3. Postgres tuning scales up accordingly: `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=16MB`, `max_connections=100`.
4. Argon2 retuning from the hardening plan still matters. Two ARM cores make concurrent login hashing the main CPU cost.
5. Run the load test from Phase 5 against the VM over the real internet, not over localhost. Local testing would hide latency and TLS handshake cost, which are the things that actually bite at 200 users.

## Phase D — Operational differences

1. Access is SSH with a key, so add the key path to the runbook. Password authentication should stay disabled.
2. Add `unattended-upgrades` for security patches, but disable automatic reboots during the event window.
3. Backups now run on the VM. Add a step that copies backups off the VM to your laptop, since a backup that only exists on the same host is not a backup.
4. `systemd` handles restart on reboot via Docker's `restart: unless-stopped`, which the compose file already sets. Verify by rebooting the VM once during rehearsal.
5. Set a billing alert at ₹1 as a safety net. Always Free resources should never bill, but an alert catches an accidental non-free resource immediately.

## Documentation changes

1. Replace `docs/DEPLOY_WINDOWS_11_CLOUDFLARE.md` with `docs/DEPLOY_ORACLE_VM.md` covering provisioning, firewall (both layers), Docker install, TLS issuance, and first boot.
2. Keep a short appendix documenting the home port-forwarding fallback, so it is ready without a rewrite if Oracle fails.
3. Update `docs/OPERATIONS.md` for SSH access, VM backups, and off-host backup copies.

## Execution order

Gate 0 first, and treat it as blocking. Then Phase A to prove the ARM build works. Then the hardening phases 1 through 6, which are unchanged in substance. Then Phase B's TLS, since a real certificate needs the DNS record live. Then C and D, measured rather than assumed.

Do all of this at least five days before the event, so an Oracle capacity problem still leaves time for the fallback.
