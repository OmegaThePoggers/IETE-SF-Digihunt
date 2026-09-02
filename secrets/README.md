# Production secrets

Create these files on the Windows 11 deployment laptop inside WSL, next to this README:

```bash
mkdir -p secrets
openssl rand -base64 32 > secrets/postgres_password.txt
openssl rand -base64 64 > secrets/jwt_secret.txt
printf 'PASTE_CLOUDFLARE_TUNNEL_TOKEN_HERE' > secrets/cloudflared_token.txt
chmod 600 secrets/*.txt
```

Never commit `*.txt` files in this directory. They are ignored by `.gitignore`.

- `postgres_password.txt`: PostgreSQL password used only inside Docker.
- `jwt_secret.txt`: signing secret for login tokens. Changing it logs everyone out.
- `cloudflared_token.txt`: Cloudflare Tunnel token. Rotate it if leaked.
