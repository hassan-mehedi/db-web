# Side-Projects Platform Plan

Self-hosted multi-project Postgres platform on an 8GB VPS, with a purpose-built
admin UI instead of an off-the-shelf database client.

---

## 1. Why this shape

Supabase self-hosted is one project per stack — that's architectural, not a
setting. Supabase Cloud works identically underneath; the dashboard just hides
it. Running 6 project-envs as 6 Supabase stacks means ~10GB of RAM in
containers, which doesn't fit.

Instead: **one shared Postgres, one database per project-env, and thin
API/admin layers on top.**

Off-the-shelf clients were evaluated and rejected:

| Tool | Verdict |
|---|---|
| Drizzle Gateway | Best UI, but wouldn't start (silent failure, likely `STORE_PATH`) |
| CloudBeaver | Works, but JVM — 400–600MB idle |
| pgweb | Explorer only, no DDL dialogs |
| Adminer | Light and functional, UI too dated |
| Outerbase Studio | Open source, modern, but no official Docker image |

Hence: build a small one. Scoped to this setup, not general purpose.

---

## 2. Architecture

```
Tailnet (no public ingress)
│
├── admin-ui        Next.js    — schema/database/role management
├── databasus       backups    → Google Drive
│
Public (Traefik + TLS)
│
├── postgrest-*     one per project-env that needs an API
└── app-*           your actual side projects
│
Internal only (dokploy-network, no published ports)
└── postgres        shared cluster
    ├── recipes_dev
    ├── recipes_prod
    ├── tracker_dev
    └── tracker_prod
```

**Database per project-env, not schema per env.** Migrations that touch
`public` get messy when two envs share a database. Separate databases on the
same server cost nothing and let you dump/restore one project cleanly.

**Naming convention:** `{project}_{env}` — lowercase, underscore. Keep it
mechanical so the admin tool can group by prefix without configuration.

---

## 3. Phase 0 — Shared Postgres

Dokploy → Compose service. Not the built-in database template; you want
control over server settings.

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17   # pgvector baked in, saves pain later
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${SUPERUSER_PASSWORD}
    command: >
      postgres
      -c max_connections=200
      -c shared_buffers=1GB
      -c effective_cache_size=3GB
      -c work_mem=16MB
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - dokploy-network

volumes:
  pgdata:

networks:
  dokploy-network:
    external: true
```

**No published ports.** Everything reaches it as `postgres:5432` over
`dokploy-network`. For a psql session, `docker exec` in.

`max_connections=200` is deliberate — see the connection budget in §8.

---

## 4. Phase 1 — Tailscale

Do this before anything else, because it determines whether the admin tool
ever needs to be internet-facing. It doesn't.

1. Install Tailscale on the VPS
2. Install the Tailscale app on your phone and laptop
3. Admin UI gets **no Dokploy domain** — reached at `http://<vps-name>:3000`
   over the tailnet

This removes the entire class of "someone found my admin panel" risk. Phone
access still works; the phone is just on the tailnet.

Public domains stay only for: PostgREST endpoints and the side-project apps
themselves.

---

## 5. Phase 2 — Roles

### 5.1 The role the admin tool connects as

**Not `postgres`.** A dedicated role with exactly the two privileges the
feature set needs:

```sql
CREATE ROLE app_admin LOGIN PASSWORD '...' CREATEDB CREATEROLE;
```

The gap to superuser is narrow but real. `app_admin` cannot:

- bypass RLS
- `COPY ... FROM PROGRAM` (which is RCE on the host)
- alter server settings
- modify roles that have superuser

That last one matters most: `postgres` stays outside the app entirely, so
there is always a role above the tool that can clean up after it.

### 5.2 Per-project bootstrap

Run once per project-env. This is what Supabase does invisibly. PostgREST
needs three roles: a login role with no privileges of its own that switches
into the others.

```sql
\set db_name 'recipes_dev'

CREATE DATABASE :db_name;
\c :db_name

-- roles PostgREST swaps into
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE web_user NOLOGIN;

-- the role PostgREST connects as: can do nothing itself
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '...';
GRANT web_anon, web_user TO authenticator;

-- only this schema is exposed
CREATE SCHEMA api;
GRANT USAGE ON SCHEMA api TO web_anon, web_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA api
  GRANT SELECT ON TABLES TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_user;
```

Two things to internalize:

- **Only `api` is reachable.** Putting a table in `public` is how you keep it
  private — the inverse of Supabase's default, and safer.
- **RLS works identically.** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` plus
  policies on `current_setting('request.jwt.claims', true)::json->>'sub'`.

Save this as a parameterized `.sql`. Later, make it a button in the admin tool.

---

## 6. Phase 3 — Backups (do this before building anything)

If losing data is the fear, this matters more than any amount of auth
hardening. Auth strength has a ceiling; a nightly dump means a worst case of
losing one day.

**Tool: Databasus** (renamed from Postgresus — check the repo for the current
image name and tag, both changed in the rename).

Why this over a script: web UI, scheduling, Google Drive as a first-class
destination, and webhook notifications. No rclone OAuth dance, no restic, no
cron.

Setup:

1. Deploy the container, volume mounted for its config
2. Add the Postgres connection — host `postgres`
3. Add Google Drive as destination
4. Daily schedule, retention ~30 days
5. Notifications → your ntfy webhook

**Approach note:** it uses logical backups (`pg_dump`), not physical with PITR.
Right trade for side projects. If you ever need second-precision recovery,
that's WAL-G, not this. (Note: pgBackRest is unmaintained as of April 2026 —
ignore it in older guides.)

**Caveats:**
- Google Drive has no object immutability. If the Google account is
  compromised or suspended, the backups go too. Add Cloudflare R2 as a second
  destination once Drive is working — it's a dropdown, and R2 needs two API
  keys with no OAuth flow.
- **Restore one.** Restore a snapshot into a scratch database, run
  `SELECT count(*)`. Do it once now, then every few months. An untested
  backup is a guess.

---

## 7. Phase 4 — The admin tool

### 7.1 Decisions locked

| | |
|---|---|
| Scope | Browse + query, create/alter tables, create databases + roles |
| Connections | Env vars only — one cluster, redeploy to change |
| Network | Tailscale only, no public domain |
| Auth | Login form **inside** the tailnet (defense in depth) |
| DB role | `app_admin` (CREATEDB + CREATEROLE) |
| Data access | Server Actions + RSC |

Env-var-only connections is the right call: no connection-management UI to
build, no credential storage to secure, no encryption-at-rest problem. One
cluster is all you have.

### 7.2 Auth specifics

Use **Better Auth**. Don't hand-roll sessions.

- Single user. **No registration endpoint at all.**
- Password as **argon2id** hash in env, never plaintext
- **TOTP 2FA** — this is where the "strict security" budget is best spent,
  far more than password complexity rules
- Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, short expiry
- **Rate limit the login route** — few attempts then exponential backoff
- No password reset flow. Nothing to phish, and you have shell access

**Critical:** Server Actions are POST endpoints. The auth check goes **inside
each action**, not only in middleware. Middleware alone is not a security
boundary in Next.js.

### 7.3 Introspection queries

The whole tool is a UI over these.

**List databases:**
```sql
SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
WHERE NOT datistemplate AND datname <> 'postgres'
ORDER BY datname;
```

**Schemas in the current database:**
```sql
SELECT nspname FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
ORDER BY nspname;
```

**Tables with row estimates and size:**
```sql
SELECT c.relname,
       n.nspname,
       c.reltuples::bigint AS est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = $1
ORDER BY c.relname;
```

**Columns:**
```sql
SELECT column_name, data_type, is_nullable, column_default,
       character_maximum_length, numeric_precision
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position;
```

**Constraints (PK, FK, unique, check) — `pg_constraint` beats
`information_schema` here, one row per constraint with the definition
pre-rendered:**
```sql
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = $1::regclass;
```

**Indexes:**
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = $1 AND tablename = $2;
```

**Roles:**
```sql
SELECT rolname, rolcanlogin, rolcreatedb, rolcreaterole, rolsuper
FROM pg_roles
WHERE rolname NOT LIKE 'pg_%'
ORDER BY rolname;
```

### 7.4 Connection handling — the one real gotcha

`CREATE DATABASE` **cannot run inside a transaction block**, and cannot run
from a connection to the database being created. So:

- Keep a pool against the `postgres` maintenance database for cluster-level
  operations (create/drop database, roles)
- Open a separate short-lived connection per target database for schema work
- Cache pools by database name; cap them small (2–3 connections each)
- **Do not** wrap `CREATE DATABASE` in a transaction — most Postgres clients
  do this implicitly for multi-statement calls, so issue it as a single
  statement

Also: dropping a database fails if anyone is connected. Either surface the
error clearly or offer a "force" that terminates backends first:

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = $1 AND pid <> pg_backend_pid();
```

### 7.5 DDL generation

**Always show the generated SQL before executing, with a confirm step.** Two
reasons: you catch mistakes, and you can copy it straight into a migration
file — which you need anyway, since clicking buttons in an admin tool doesn't
version your schema.

Build SQL from a typed structure, never string-concatenate user input:

- Identifiers → quote with `format('%I', name)` server-side, or a
  well-tested quoting helper client-side
- Literals → `format('%L', value)`
- Never interpolate raw strings into DDL

Destructive operations (`DROP TABLE`, `DROP DATABASE`, `DROP COLUMN`) get a
type-the-name-to-confirm dialog, not a plain OK button.

### 7.6 Route structure

```
/login
/                              → database list, sizes, connection counts
/db/[database]                 → schemas + tables
/db/[database]/[schema]/[table]
    ?tab=data                  → paginated rows, inline edit
    ?tab=columns               → column editor
    ?tab=constraints
    ?tab=indexes
/db/[database]/query           → SQL editor
/roles                         → list, create, grant
```

### 7.7 Build order

Ship something usable after one evening, not three weekends.

**Evening 1 — read-only, and already better than nothing**
- Better Auth login (password only, add TOTP later)
- Database list page
- Table list per database
- SQL editor with results grid

At this point it's a nicer pgweb, scoped to your cluster.

**Evening 2 — the thing TablePlus can't do**
- `CREATE DATABASE` with the bootstrap SQL from §5.2 as a checkbox
  ("also set up PostgREST roles")
- Drop database with force-disconnect
- Role list + create

This is the actual reason the project exists. Get here fast.

**Evening 3 — schema editing**
- Column editor: add, alter type, set nullable, set default
- Create table form
- Preview-SQL-then-confirm flow

**Later, if it earns it**
- Data grid inline editing
- FK/index management
- ER diagram
- Saved queries

### 7.8 Stack

- Next.js (App Router), Server Actions + RSC
- `pg` driver directly — **not** an ORM. You're introspecting arbitrary
  schemas; an ORM's typed models are the wrong abstraction here
- Better Auth + argon2id + TOTP plugin
- Tailwind + shadcn/ui — gets you the modern look without design work, which
  was the whole complaint about the existing tools
- Deploy: Dokploy, on `dokploy-network`, no domain

---

## 8. Phase 5 — PostgREST per project-env

One container per database that needs an API. ~30–40MB each.

```yaml
services:
  postgrest:
    image: postgrest/postgrest:v13.0.0
    restart: unless-stopped
    environment:
      PGRST_DB_URI: postgres://authenticator:${PW}@postgres:5432/recipes_dev
      PGRST_DB_SCHEMAS: api
      PGRST_DB_ANON_ROLE: web_anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_POOL: 6
      PGRST_OPENAPI_MODE: disabled
    networks:
      - dokploy-network

networks:
  dokploy-network:
    external: true
```

Attach a domain per service — `api.recipes.example.com`,
`api-staging.recipes.example.com`. Traefik handles TLS.

**Auth**, when a project needs it: Better Auth in the app itself (a library,
not another container), with the `jwt` plugin issuing tokens PostgREST
verifies. The claims must carry a `role`:

```ts
jwt({
  jwt: {
    definePayload: ({ user }) => ({
      sub: user.id,
      role: "web_user",     // PostgREST reads this to pick the DB role
      email: user.email,
    }),
  },
})
```

If Better Auth uses asymmetric keys (EdDSA by default), point
`PGRST_JWT_SECRET` at its JWKS endpoint instead of a shared secret.

**Skip all of this until a project actually goes public.** For a private side
project, run PostgREST with one role reachable only over `dokploy-network`, or
skip PostgREST entirely and query from the app.

### Connection budget

Every PostgREST container holds an idle pool. Six project-envs at
`PGRST_DB_POOL=6` is 36 connections sitting idle, plus app pools, plus
migrations, plus the admin tool. Hence `max_connections=200`.

Past ~8 project-envs, put **PgBouncer** in transaction mode between PostgREST
and Postgres. Not needed on day one — just know it's the escape hatch.

---

## 9. Resource budget

| Component | RAM |
|---|---|
| Postgres (shared) | ~1.5GB |
| Admin tool (Next.js) | ~150MB |
| Databasus | ~100MB |
| PostgREST × 6 | ~250MB |
| Dokploy + Traefik | ~500MB |
| Beszel, Uptime Kuma, ntfy | ~300MB |
| **Available for apps** | **~5GB** |

Versus roughly two Supabase stacks and nothing else.

---

## 10. Security checklist

- [ ] Admin tool has no public domain — tailnet only
- [ ] Postgres has no published ports
- [ ] App connects as `app_admin`, never `postgres`
- [ ] `postgres` superuser password stored only in Dokploy env
- [ ] Argon2id password hash, TOTP enabled
- [ ] Auth check inside every Server Action, not just middleware
- [ ] Login route rate limited
- [ ] No registration endpoint exists
- [ ] Destructive actions require typing the object name
- [ ] All DDL built from typed structures, identifiers quoted
- [ ] Backups running, notifications wired to ntfy
- [ ] **One restore actually tested**
- [ ] Second backup destination (R2) added

---

## 11. Deferred

- **Storage** — MinIO or R2 with presigned URLs and a `files` table. Not
  needed for most side projects.
- **Realtime** — Postgres `LISTEN/NOTIFY` directly, or Supabase's Realtime
  container standalone if it ever matters.
- **Bootstrap-as-a-button** — start by running the §5.2 SQL by hand. Automate
  it in the tool once you've done it three times and know what varies.
- **Migrations** — the admin tool doesn't version your schema. Keep using
  whatever migration tool the project already has; copy the previewed SQL
  into it.
