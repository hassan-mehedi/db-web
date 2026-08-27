# db-web v3: optimization

v2 added the Neon-style layout, monitoring, cloning and query history. v3 adds no
features. It cuts the work each page does, the work the sampler does every minute,
and the bytes the browser downloads, and it adds the numbers to prove it.

## Measured before v3 (local, 1 database, 2026-08-27)

- Page render 40 to 60 ms locally. VPS numbers were not available, which is why
  phase A ships first.
- Table page: `count(*)` on every load plus `LIMIT/OFFSET`.
- Sidebar: `pg_database_size()` per database on every layout render.
- Sampler: one INSERT per database plus one per top statement per minute, two
  retention DELETEs per minute, no index on `ts`.
- Charts: 7d window returns 10080 points per series.
- Client: 472 kB CodeMirror chunk loaded on every page.
- Image: 308 MB, no HEALTHCHECK, no memory limit.

## Phases

### V3-A Server timing
`lib/timing.ts` with `timed(label, fn)` collecting per-request durations through
React `cache`. `AppShell` prints the total in the header and logs one JSON line
per render (`action: "render"`, path, per-label ms) to stdout so Dokploy logs
carry the numbers.

### V3-B Table data
- Row count from `pg_class.reltuples` (marked "~"), exact count only via
  `?count=exact` link.
- Keyset paging on the primary key (`WHERE (pk) > ($after)`), OFFSET fallback for
  tables without a key. Prev/Next carry cursors in the URL.

### V3-C Database list
- Sizes and connection counts come from the latest `metric_sample` row per
  database. `pg_database_size()` runs only for databases with no sample yet.
- One grouped join for connections instead of a subquery per row.

### V3-D Sampler and series
- One multi-row INSERT for metrics and one for statements per tick.
- Retention DELETE once an hour, not once a minute.
- Index on `metric_sample (ts)` and `statement_sample (ts)`.
- `getSeries` buckets with `date_bin`: 1 min for 1h, 5 min for 24h, 30 min for 7d.

### V3-E Pools
- `max: 2` per database pool.
- Pools unused for 10 minutes are ended and dropped from the map.

### V3-F Client and streaming
- `SqlEditor` loaded with `next/dynamic` so CodeMirror ships only on the SQL page.
- Monitoring page streams: tiles and charts, statements, and activity each in
  their own `Suspense` with a skeleton.

### V3-G Ops
- `/api/health` route and a Docker `HEALTHCHECK`.
- Runner stage keeps only the standalone output; `mem_limit` in the admin compose.

## Out of scope
Anything that adds a feature (backups, migrations, alerts, audit page, API keys).
Those are listed for v4 in the session notes.
