# db-web

A small admin UI for one shared Postgres server that hosts many side projects.
One database per project and environment (`blog_dev`, `blog_prod`), grouped in
the sidebar by prefix. Built because Supabase self-hosted needs a whole stack
per project and the off-the-shelf clients were either heavy (CloudBeaver) or
explorer-only (pgweb).

What you get:

- Projects and envs: create, clone (`CREATE DATABASE ... TEMPLATE`), drop, with
  the SQL shown before it runs.
- Per env: tables with DDL dialogs (columns, constraints, indexes), read and
  drop for triggers and RLS policies, a dependencies view, a data grid with
  keyset paging, filters, inline edit, row detail, column hide and resize, CSV
  export and import, a SQL editor with autocomplete, run-at-cursor, per
  statement result tabs, cancel, an explain plan tree, history and saved
  queries, an ER diagram, roles, a Connect page with PostgREST and psql
  strings, and a Monitoring page (connections, cache hit, size, slow statements
  from `pg_stat_statements`, lock waits, active sessions, dead rows, unused
  indexes).
- One admin user, password plus TOTP, created in the browser on first run.
- The app's own state (auth, saved queries, one-minute metric samples) lives in
  a `db_web_meta` database on the same server. The app user `app_admin` has
  `CREATEDB CREATEROLE` and no superuser.

## Install on a VPS

Needs Docker with the compose plugin.

```sh
curl -fsSL https://raw.githubusercontent.com/hassan-mehedi/db-web/dev/install.sh | sh
```

This writes `./db-web/{compose.yml,init/,.env}` with generated passwords and
starts Postgres 17 (pgvector image, `pg_stat_statements` loaded) and the admin
app. Open the URL it prints, create the admin user, scan the TOTP code, store
the backup codes.

By default both ports bind to `127.0.0.1`. To reach the app from other
machines, pick one:

- Tailscale (what I use): `BIND_IP=$(tailscale ip -4) DB_WEB_URL=http://<tailnet-name>:3100 sh install.sh`.
  Nothing is exposed to the internet.
- A reverse proxy with TLS (Caddy, Traefik, nginx) in front of `127.0.0.1:3100`,
  with `DB_WEB_URL=https://db.example.com` in `.env`. `BETTER_AUTH_URL` must
  match the address you type in the browser or sign-in fails with a
  trusted-origin error.

Do not set `BIND_IP=0.0.0.0` without TLS in front. See `SECURITY.md`.

`.env` knobs: `ADMIN_PORT` (3100), `POSTGRES_PORT` (5432), `PG_SHARED_BUFFERS`
(256MB), `PG_EFFECTIVE_CACHE_SIZE` (768MB), `PG_WORK_MEM` (8MB),
`PG_MAX_CONNECTIONS` (100), `DB_WEB_IMAGE` (pin a version such as
`ghcr.io/hassan-mehedi/db-web-admin:v4.0.0`), `BACKUPS_URL` (adds a sidebar
link, for example to Databasus).

Upgrade:

```sh
cd db-web && docker compose pull && docker compose up -d
```

Already have a Postgres? Drop the `postgres` service from `compose.yml`, run
`infra/sql/01-app-admin.sh` once against your server, and point
`DATABASE_URL_MAINTENANCE` and `DATABASE_URL_META` at it. The Dokploy variant
I run lives in `infra/` (see `infra/README.md`).

## Develop

```sh
pnpm install
pnpm db:up                       # Postgres on 5436 with the init script
cp .env.example apps/admin/.env.local
pnpm dev                         # http://localhost:3000, first visit is /setup
```

Checks, same as CI: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm --filter admin e2e` (needs `pnpm --filter admin build` first).

Layout: `apps/admin` (Next.js 16, Better Auth, Tailwind), `packages/sql`
(introspection and DDL builders, all identifiers quoted), `packages/db` (pool per
database with idle eviction), `packages/bootstrap` (the SQL plan for creating a
project env with `anon`, `user` and `authenticator` roles for PostgREST).

## License

MIT.
