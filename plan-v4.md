# v4: installable by anyone

v3 made the app fast. v4 makes it something a stranger can run on their own
VPS with one command. Features wait for v5.

## What blocks a stranger today

- No root README, no LICENSE. GitHub shows an empty page and nobody may legally
  copy the code.
- The Better Auth tables and the first user come from a laptop: `psql <
  better-auth-schema.sql`, then `pnpm seed:admin` over an SSH tunnel with `tsx`.
- Compose files need Dokploy's external network and a Tailscale IP.
- No published image. Everyone builds 306 MB from source.
- No security headers on responses.

## Phases

### V4-A first-run setup in the browser

- The app applies the Better Auth tables itself on boot (idempotent SQL in
  `lib/auth-schema.ts`, run from `ensureMetaSchema`).
- `/setup` shows once, while the `user` table is empty: email, password, then a
  QR code and backup codes, then a code check. On success it lands on
  `/projects`. Once a user exists the route redirects to `/login`.
- `/login` redirects to `/setup` while there is no user.
- Delete `scripts/seed-admin-user.ts`, `tsx`, `qrcode-terminal`,
  `infra/sql/better-auth-schema.sql`.
- Playwright: a `setup` project walks `/setup` for real and writes the TOTP
  secret; the `smoke` project depends on it.

### V4-B one-command install

- `compose.yml` at the repo root: postgres + admin, no Dokploy network.
  `BIND_IP` defaults to `127.0.0.1`. `infra/sql/01-app-admin.sh` mounted into
  `/docker-entrypoint-initdb.d` so `app_admin` and `db_web_meta` exist on first
  start. Postgres memory settings come from env with small defaults.
- `install.sh`: checks for docker, downloads `compose.yml` and the init
  script, writes `.env` with generated passwords and `BETTER_AUTH_SECRET`,
  runs `docker compose up -d`, prints the URL.
- CI publishes `ghcr.io/hassan-mehedi/db-web-admin` on pushes to `dev`
  (`:dev`) and on tags (`:vX.Y.Z`, `:latest`). The root compose pulls the
  image; `infra/admin/compose.yml` keeps building from source for Dokploy.
- Root `README.md` with the one-liner, what you get, how to put it behind
  Tailscale or a TLS proxy, how to upgrade. `LICENSE` (MIT).

### V4-C hardening for a public install

- Response headers in `next.config.ts`: `Content-Security-Policy`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Content-Type-Options`.
- `SECURITY.md`: never publish port 3000 to the internet without TLS and a
  reverse proxy, TOTP is mandatory, how to report a problem.

## Out of scope

Backups in-app, data grid filters and CSV export, schema diff, alerts, audit log,
API keys. Those are v5.
