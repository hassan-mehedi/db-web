# db-web — build plan

Monorepo for the side-projects platform: one shared Postgres, one database per
project-env, a purpose-built admin UI reached only over Tailscale. This file is
the execution plan. `db-gateway.md` holds the reasoning behind the architecture
and stays as the design reference.

## Decisions (from discussion, 2026-08-25)

| Topic | Decision |
|---|---|
| Repo scope | Whole platform as a monorepo: admin app, infra compose files, shared packages |
| Tooling | pnpm workspaces + Turborepo, TypeScript everywhere |
| Existing VPS | Dokploy + Traefik running. Shared Postgres already up, matches the compose in `db-gateway.md` §3, no real data yet. Tailscale and backups not yet set up |
| Auth | Better Auth with its own database `db_web_meta` in the shared cluster. User seeded once by CLI script. No signup route. TOTP plugin |
| Write scope | Full write everywhere. SQL editor runs as `app_admin`; data grid gets inline edit later |
| Editor / grid libs | CodeMirror 6 (`@codemirror/lang-sql`) and TanStack Table, chosen up front |
| Tests | Vitest for the SQL builder and quoting. GitHub Actions for lint, typecheck, test. Integration and e2e tests deferred |
| Deploy | Dokploy compose from this repo, on `dokploy-network`, no domain |
| Git | Default branch `dev`; remote to be added later |
| Linter | Biome |
| Local dev | `compose.dev.yml` with pg17 + pgvector; all testing happens locally in Docker |
| VPS steps | Run manually by Mehedi (compose verify, `app_admin`, `db_web_meta`, Tailscale). Repo only ships the files |
| Tailscale host | Placeholder `db-web-vps` until known |

Suggestions folded in below that were not in the original doc:

- `db_web_meta` is hidden from the database list and blocked from drop.
- Databases ending in `_prod` get a visible red environment badge and a
  longer confirm on destructive actions. The naming convention already
  exists; use it.
- The bootstrap SQL lives in a package, not a loose file, so the CLI and the
  admin tool run the same text.
- Every mutating Server Action logs `{ts, action, database, sql}` to stdout.
  Cheap audit trail, Dokploy keeps the logs.
- Postgres roles are cluster-wide, so the §5.2 `web_anon` / `web_user` /
  `authenticator` names collide on the second project-env. Bootstrap names
  them `{db}_anon`, `{db}_user`, `{db}_authenticator`. The PostgREST
  template and the app's JWT `role` claim must use the same names.
- Local dev Postgres listens on 5436 (5432 is taken by another project).

## Repo layout

```
db-web/
├── apps/
│   └── admin/                 Next.js app (App Router)
├── packages/
│   ├── sql/                   DDL builder, identifier/literal quoting, introspection queries
│   ├── bootstrap/             per-project-env bootstrap SQL as a parameterised template
│   └── db/                    pg pool manager (maintenance pool + per-database pools)
├── infra/
│   ├── postgres/compose.yml   shared cluster (adopted from the running instance)
│   ├── admin/compose.yml      admin app for Dokploy
│   ├── postgrest/compose.template.yml
│   └── sql/                   cluster-level one-offs: app_admin role, db_web_meta
├── scripts/
│   └── seed-admin-user.ts     creates the single Better Auth user + prints TOTP setup
├── .github/workflows/ci.yml
├── turbo.json
├── pnpm-workspace.yaml
└── plan.md
```

`packages/sql` is the part that must be right. It has no React or Next.js
dependency so it can be tested in isolation and reused by the seed script.

## Phase A — repo and infra baseline (first session)

1. `pnpm init`, workspaces, Turborepo, shared `tsconfig`, Biome.
2. Copy the running Postgres compose into `infra/postgres/compose.yml`. Check
   with `docker inspect` on the VPS that the config in the repo matches what
   is actually running before calling it the source of truth.
3. `infra/sql/01-app-admin.sql`: `CREATE ROLE app_admin LOGIN PASSWORD ...
   CREATEDB CREATEROLE;`
4. `infra/sql/02-db-web-meta.sql`: `CREATE DATABASE db_web_meta OWNER app_admin;`
5. Run both once on the VPS via `docker exec` as `postgres` (manual).
   Locally, `compose.dev.yml` mounts `infra/sql/` into
   `/docker-entrypoint-initdb.d` so the dev cluster gets the same roles.
6. Tailscale on VPS, laptop, phone (manual). Confirm `http://<vps>:3000` is the only
   path to the admin app before the app exists.

Exit: the repo installs, `turbo build` runs an empty Next.js app, `app_admin`
can log in to `db_web_meta`.

## Phase B — admin app, read-only (evening 1)

Status 2026-08-26: done and verified locally with Playwright (login, TOTP,
browse, all four tabs, pager, query cap 1000 + expand, Cmd+Enter, error
display, sign out). Seed script is `pnpm --filter admin seed:admin`; Better
Auth schema SQL for the VPS is `infra/sql/better-auth-schema.sql` (apply to
`db_web_meta` by hand, or run `pnpm dlx auth@1.7.1 migrate` with
`DATABASE_URL_META` set). Auth origin check means `BETTER_AUTH_URL` must be
exactly the URL you browse to.

Goal from the design doc: usable after one evening.

1. Next.js app in `apps/admin`, Tailwind, shadcn/ui.
2. `packages/db`:
   - `maintenancePool()` → connects to database `postgres` as `app_admin`
   - `poolFor(database)` → cached per database, `max: 3`, idle timeout 30s
   - `withClient(database, fn)` helper
3. Better Auth wired to `db_web_meta`. Email+password provider, signup
   disabled in config. `scripts/seed-admin-user.ts` creates the one user.
   Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, 12h expiry.
   Rate limit `/api/auth/*` with Better Auth's built-in limiter.
4. `requireSession()` helper called as the first line of every Server Action
   and every RSC page. Middleware redirects only; it is not the boundary.
5. Pages:
   - `/login`
   - `/` database list with size, connection count, env badge
   - `/db/[database]` schemas and tables with row estimate and size
   - `/db/[database]/[schema]/[table]?tab=data|columns|constraints|indexes`
     (read-only in this phase)
   - `/db/[database]/query` CodeMirror editor, run selection or all, results
     in TanStack Table, statement timeout 30s, row cap 1000 with a
     "show more" that re-runs with a higher cap
6. Introspection queries from `db-gateway.md` §7.3 live in `packages/sql/introspect.ts`.

Exit: browse every database and run ad-hoc SQL from the phone over the tailnet.

## Phase C — cluster operations (evening 2)

The reason the project exists.

Status 2026-08-26: done and verified locally with Playwright (create with
bootstrap, authenticator login, duplicate error, roles list with superuser
read-only, create/grant/revoke/drop role, drop database blocked by an open
connection then forced). Authenticator password is shown once and not stored.

1. `packages/bootstrap`: the §5.2 SQL as a function
   `bootstrapProjectEnv({ database, authenticatorPassword })` returning an
   ordered array of statements. `CREATE DATABASE` is issued alone on the
   maintenance pool; the rest run on a fresh connection to the new database.
2. Create database dialog: name validated against `^[a-z][a-z0-9]*_[a-z0-9]+$`,
   checkbox "also set up PostgREST roles", generated password shown once.
3. Drop database: type-the-name confirm, `_prod` requires typing it twice,
   optional force that runs `pg_terminate_backend` first. `db_web_meta` and
   `postgres` refuse.
4. `/roles`: list, create (login / nologin, CREATEDB, CREATEROLE), grant role
   to role, drop. Roles with `rolsuper` are shown but every action on them is
   disabled.
5. Every action here follows preview → confirm → execute, and logs the SQL.

Exit: a new project-env, including PostgREST roles, is a form and one click.

## Phase D — schema editing (evening 3)

Status 2026-08-26: done and verified locally with Playwright (create table
with identity pk, batch of add/rename/drop-not-null/type in one transaction,
a failing batch rolls back fully, drop table with type-to-confirm).

1. `packages/sql/ddl.ts`: typed builders
   - `createTable({ schema, name, columns, primaryKey })`
   - `addColumn`, `alterColumnType`, `setNotNull`, `dropNotNull`,
     `setDefault`, `dropDefault`, `renameColumn`, `dropColumn`
   - `quoteIdent`, `quoteLiteral` with Vitest cases for quotes, unicode,
     reserved words, empty strings, `pg_` prefixes
2. Column editor tab wired to the builders. Every change accumulates into a
   pending list; "Apply" shows the combined SQL, then runs it in one
   transaction.
3. Create table form.
4. Constraints and indexes tabs stay read-only in this phase.

Exit: schema changes can be made from the UI and the SQL copied into the
project's own migration tool.

## Phase E — deploy and backups

1. `infra/admin/compose.yml` with a multi-stage Dockerfile (`output:
   'standalone'`), env: `DATABASE_URL_MAINTENANCE`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL=http://<tailscale-name>:3000`.
2. Dokploy compose service pointed at this repo, no domain, port 3000 bound
   to the Tailscale interface only.
3. Databasus: deploy, connect to `postgres`, Google Drive destination, daily,
   30-day retention, ntfy webhook. Verify the current image name in the
   Databasus repo before writing the compose.
4. Restore one snapshot into a scratch database and count rows. Put the date
   in this file when done.
5. Add R2 as a second destination.

## Phase F — later, only if it earns it

- Data grid inline edit, insert, delete (keyed on primary key; tables without
  one stay read-only)
- FK and index management
- Saved queries in `db_web_meta`
- ER diagram
- Bootstrap generating a ready-to-paste PostgREST compose from the template
- Integration tests against a throwaway pg17 container in CI
- Playwright e2e for login and create-database

## Testing and CI

- `packages/sql`: Vitest, target every builder and both quoting functions.
  This is the only code that can silently corrupt a schema.
- `packages/bootstrap`: snapshot test of the generated statements for one
  fixed input.
- CI (`.github/workflows/ci.yml`): pnpm install, `turbo lint typecheck test
  build` on PR and on `main`.
- Dokploy deploys from `main` after CI passes.

## Security checklist

Carried from `db-gateway.md` §10, with additions:

- [ ] Admin app has no public domain; port 3000 bound to the tailnet only
- [ ] Postgres has no published ports
- [ ] App connects as `app_admin`, never `postgres`
- [ ] `postgres` superuser password stored only in Dokploy env
- [ ] Better Auth signup disabled; user exists only via seed script
- [ ] TOTP enabled on the seeded user before first deploy
- [ ] `requireSession()` inside every Server Action and RSC page
- [ ] Auth routes rate limited
- [ ] Destructive actions require typing the object name; `_prod` twice
- [ ] `db_web_meta` and `postgres` cannot be dropped from the UI
- [ ] All DDL built from `packages/sql`, never string concatenation
- [ ] Every mutation logged with its SQL
- [ ] Backups running, ntfy wired
- [ ] One restore tested (date: ____)
- [ ] R2 second destination

## Open items

- Package manager version and Node version: pin in `package.json` `engines`
  and `.nvmrc` at init, after checking what Dokploy's build image supports.
- Whether Better Auth's rate limiter is enough on its own or Traefik-level
  limiting is also wanted. Tailnet-only makes this low priority.
- Turbo remote cache: skip unless CI gets slow.
