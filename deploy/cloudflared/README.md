# Cloudflare Tunnel notes

The production stack runs `cloudflared` as a Docker service. You do not need to install `cloudflared` directly on Windows.

Cloudflare Zero Trust public hostname settings:

- Public hostname: `hunt.yourdomain.com`
- Service type: `HTTP`
- Service URL: `nginx:80`

Store the tunnel token in:

```text
secrets/cloudflared_token.txt
```

The token file is intentionally ignored by Git.
