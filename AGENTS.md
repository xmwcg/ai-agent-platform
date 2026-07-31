# AGENTS.md

## Project

AI Agent Platform is the primary production application for `aibak.site` and `www.aibak.site`.

## Mandatory Production Domain Rule

The following rule is non-negotiable and applies to every developer, operator, AI agent, deployment script, and infrastructure tool:

- `aibak.site` and `www.aibak.site` MUST always serve AI Agent Platform.
- The frontend root MUST remain `/opt/ai-agent-platform/client/dist`.
- Requests under `/api/*` MUST be proxied to `127.0.0.1:3000`.
- The domains MUST NOT be redirected or proxied to another project, service, directory, or port.
- Port `3100` belongs to the Jinwangtong LAN project and MUST NOT be bound to either production domain.
- Self-signed certificates MUST NOT be used for the public production domains.
- `acli hermes webui` or any other automated tool MUST NOT overwrite the `aibak.site` Caddy site block.

Changing these constraints is a P0 production change and requires explicit written approval from the project owner, Long Ge.

Authoritative deployment policy: `docs/DEPLOYMENT-LOCK.md`.

## Production Caddy Contract

```caddyfile
aibak.site www.aibak.site {
    tls /etc/caddy/certs/aibak.site.crt /etc/caddy/certs/aibak.site.key

    root * /opt/ai-agent-platform/client/dist

    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Before any production deployment:

1. Back up `/etc/caddy/Caddyfile`.
2. Verify the site block still matches this contract.
3. Run `caddy validate --config /etc/caddy/Caddyfile`.
4. Restart with `systemctl restart caddy` because the admin API is disabled.
5. Verify `https://aibak.site/` returns the AIbak frontend.
6. Verify `https://aibak.site/api/health` reports healthy MongoDB and Redis.
7. Verify the public certificate issuer is Let's Encrypt.

## Development Commands

Use the package manager selected by the repository lockfiles. Run the relevant type checks, tests, lint, and build before reporting completion.

## Change Discipline

- Make focused changes only.
- Do not rewrite unrelated files.
- Never commit credentials or production secrets.
- Preserve existing user changes in a dirty working tree.
- Update `MEMORY.md` for durable architecture and production decisions.
