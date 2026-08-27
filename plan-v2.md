# db-web v2 — Neon-style console

v1 (all phases in `plan.md`) is deployed at `http://vmi3524118:3100`. v2 keeps
the same backend packages and security rules and rebuilds the UI around
projects, with a Neon-inspired dark theme. Nothing in v2 is a real Neon
feature that depends on Neon's storage engine (branching, autoscaling,
scale-to-zero, PITR); those are out of scope on one shared Postgres.

## Decisions (2026-08-26)

| Topic | Decision |
|---|---|
| Projects | Parsed from database names. `blog_dev` + `blog_prod` show as project `blog` with environments `dev`, `prod`. No new table |
| Environment cloning | Schema and data via `CREATE DATABASE new TEMPLATE source`. The source must be idle; the dialog terminates its backends after a typed confirm |
| Monitoring | Sampled history. The admin app samples `pg_stat_*` every minute into `db_web_meta`, keeps 7 days. Needs `pg_stat_statements` in the Postgres compose |
| Layout | Replace. Sidebar shell, new palette, routes under `/projects`. Old `/db/...` routes redirect |
| Backups page | Dropped. Databasus has no HTTP API (README checked 2026-08-26). The sidebar gets a plain link to `http://<host>:4005` instead |
| Theme | Neon-inspired, not a copy. Near-black background, dark gray cards, one green accent, mono font for anything copyable. Own name and logo |

Palette (starting point, tune by eye):

| Token | Value |
|---|---|
| `--background` | `#0c0d0d` |
| `--card` / `--sidebar` | `#131415` |
| `--border` | `#262829` |
| `--foreground` | `#e4e5e7` |
| `--muted-foreground` | `#8b8f94` |
| `--primary` (accent) | `#00e599` on `#0c0d0d` text |
| `--destructive` | `#ff4d4f` |
| `--font-mono` | Geist Mono, connection strings, SQL, identifiers |

`#00e599` is the green I remember from Neon's brand; adjust if it looks off
next to the grays.

## Route map

```
/projects                          all projects, card per project, env chips
/projects/[project]                overview: envs table, size, connections, quick actions
/projects/[project]/[env]          database overview (was /db/[database])
  /tables                          tree + grid, full width (was the table page)
  /tables/[schema]/[table]         same view, table selected, tabs data/columns/constraints/indexes
  /query                           editor + history + saved
  /diagram
  /roles                           this env's roles, global toggle
  /connect                         connection details
  /monitoring                      charts
  /settings                        clone, drop
/roles                             global roles (kept)
/login, /login/2fa                 unchanged
```

`/db/[database]` and children redirect to the new paths so bookmarks keep
working. `[env]` in a URL is the part after the last underscore; the database
name is `${project}_${env}`.

## Phases

### V2-A — shell and theme

1. `globals.css`: replace the shadcn defaults with the palette above. Keep
   the `.dark` class on `<html>`; drop the light variables since there is no
   light mode.
2. Sidebar shell (shadcn `sidebar`): logo, project switcher at the top,
   env switcher under it, nav for the env pages, footer with Roles, Backups
   link, sign out. Breadcrumbs in the top bar. Collapses to icons on phone.
3. `lib/projects.ts`: `parseDatabaseName("blog_dev") → {project:"blog", env:"dev"}`,
   `groupByProject(databases)`. Unit tests, including names with several
   underscores (`my_app_dev` → project `my_app`, env `dev`).
4. `/projects` and `/projects/[project]` pages. Create project = create
   database dialog with the name split into two fields.
5. Move existing pages under the new routes, add redirects in `proxy.ts`.
6. Update Playwright e2e for the new paths.

Exit: every v1 feature reachable from the new shell, in the new colours.

### V2-B — connection details and per-env roles

1. `/connect`: cards for `psql`, Node `pg`, Prisma, PostgREST URL. Host is the
   Docker service name inside `dokploy-network` and the Tailscale hostname
   outside; a toggle switches. Role picker: `app_admin` (no password shown),
   `{db}_authenticator` (password not stored, field says so with a reset
   button that runs `ALTER ROLE ... PASSWORD` and shows the new one once).
2. `/roles` under an env: the three bootstrap roles for that database with
   their grants, plus "show all cluster roles".

### V2-C — tables view

1. Left tree: schema → table, row estimate, search box, collapsible. Right:
   the existing DataGrid and tabs, full width.
2. Tree state (open schemas, selected table) in the URL so back works.
3. Row count badge and a refresh button per table.

### V2-D — monitoring

1. `infra/postgres/compose.yml`: add `-c shared_preload_libraries=pg_stat_statements`
   to the command. This needs a Postgres restart on the VPS (manual step,
   write it in `infra/README.md`). `CREATE EXTENSION pg_stat_statements` in
   the `postgres` database from the bootstrap.
2. `db_web_meta.metric_sample (ts, database, connections, xact_commit,
   xact_rollback, blks_hit, blks_read, tup_returned, tup_fetched, tup_inserted,
   tup_updated, tup_deleted, size_bytes)` plus `statement_sample` for the
   top 20 by total time. Sampler in `instrumentation.ts` with `setInterval`
   60s, guarded so one process samples. Delete rows older than 7 days on
   each run.
3. `/monitoring`: connections, cache hit ratio, commits/rollbacks, rows,
   size, all over the selected window (1h, 24h, 7d). Slow query table from
   `statement_sample` with an explain link into the editor. Charts with a
   small SVG line chart component; no chart library.
4. Live panel: `pg_stat_activity` for this database, with a terminate
   button per backend (confirm).

### V2-E — environment cloning

1. `packages/sql`: `cloneDatabase({source, target})` →
   `CREATE DATABASE target TEMPLATE source OWNER app_admin`. Bootstrap roles
   for the target after (`{target}_anon` etc.) and re-grant, since roles are
   cluster-wide and the template copy keeps grants to the source's roles.
2. Dialog on `/settings` and on the project page: pick source env, type the
   new env name, see connections on the source, typed confirm terminates
   them, then clone. `_prod` source needs the name typed twice.
3. Integration test: clone `itest_dev` to `itest_clone`, compare table list
   and one row count.

### V2-F — query history and explain

1. `db_web_meta.query_history (id, database, sql, rows, duration_ms, error,
   ran_at)`. Written by `executeQuery`. Keep the last 500 per database.
2. History pane in the editor next to saved queries; click to load.
3. Explain button runs `EXPLAIN (ANALYZE false, FORMAT TEXT)` on the current
   selection and shows the plan in a monospace panel. `ANALYZE` is a second
   button with a confirm, since it executes the statement.

## Order and effort

A (shell, theme, routes) first, everything else sits inside it. Then B, C, D,
E, F. Each phase ends with lint, typecheck, unit tests, Playwright e2e, and a
`docker build` with no env, the same checks that caught the v1 deploy bug.

## Open items

- Branch for v2 work: proposal is a `v2` branch off `dev`, merged back when
  V2-A is usable. Mehedi decides the name.
- Whether the sampler should be a separate compose service instead of running
  inside the Next.js process. In-process is simpler; a second replica would
  double-sample. Dokploy runs one replica, so in-process is fine for now.
- Restore test date for v1 is still blank in `plan.md`.
