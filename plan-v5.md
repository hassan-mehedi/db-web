# v5: daily use

v4 made the app installable by a stranger. v5 adds the things that were out of
scope there and that come up every day once the app is running: getting data
out, a record of what the UI changed, keeping envs in sync, and being told
when something is wrong.

## State on 2026-08-28

- Data grid has filters (`FilterBar`, `table-filters.ts`) and keyset paging.
  No export of any kind. Cells of a `GENERATED ALWAYS` identity column are
  editable and the UPDATE fails in Postgres.
- `lib/audit.ts` writes one JSON line to stdout per DDL or DML action. Nothing
  is stored, nothing is shown in the UI.
- Monitoring samples connections, cache hit, size and slow statements every
  minute into `db_web_meta`. Nothing reads them except the charts.
- Backups are a sidebar link (`BACKUPS_URL`) to an external tool.

## Phases

### V5-A export and grid fixes

- Export the current table view as CSV: same filters, all rows, streamed from a
  route handler (`/api/export`) with `COPY (SELECT ...) TO STDOUT CSV HEADER`.
  Button next to Filter. Same for a query result in the SQL editor.
- Identity `ALWAYS` cells are read only in the grid, with the same "auto
  increment" hint as the insert dialog.

### V5-B audit log

- `audit()` also inserts into `db_web_meta.audit_log` (ts, user, action,
  database, sql, duration, error). Retention 90 days, cleaned by the sampler's
  hourly job.
- An Activity page per env and a global one under `/activity`, newest first,
  filter by database and action, with the SQL shown in full.

### V5-C schema diff

- Pick two databases of one project (`blog_dev` against `blog_prod`). Compare
  tables, columns, constraints and indexes using the existing introspection in
  `packages/sql`.
- Show the diff as a list of changes and as the `ALTER` SQL that would bring the
  target in line, built with the existing DDL builders. Apply from the page with
  the same confirm-SQL flow as the other dialogs.

### V5-D alerts

- Rules stored in `db_web_meta.alert_rule`: metric, threshold, window, per
  database or all. Defaults created on first run: connections above 80% of
  `max_connections`, cache hit below 90% for 10 minutes, disk growth above 20%
  in a day.
- The sampler evaluates rules each tick and writes `alert_event` rows. The
  header shows a badge with open alerts; the Monitoring page lists them.
- Optional webhook URL in `.env` (`ALERT_WEBHOOK_URL`) that receives a JSON
  POST per event. No email.

### V5-E backups

- `pg_dump` of one database from the Settings page, streamed as a download
  (`--format=custom`). Runs the `pg_dump` binary from the Postgres client
  package added to the admin image.
- Restore is out of scope. The download is for taking a copy before a risky
  change, not for disaster recovery. Keep `BACKUPS_URL` for that.

## Out of scope

API keys, multiple users, row level security editor, PostgREST hosting.
