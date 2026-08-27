export const listDatabases = `
SELECT d.datname,
       pg_size_pretty(pg_database_size(d.datname)) AS size,
       pg_database_size(d.datname) AS size_bytes,
       (SELECT count(*) FROM pg_stat_activity a WHERE a.datname = d.datname)::int AS connections
FROM pg_database d
WHERE NOT d.datistemplate AND d.datname NOT IN ('postgres', 'db_web_meta')
ORDER BY d.datname`;

export const listSchemas = `
SELECT nspname FROM pg_namespace
WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
ORDER BY nspname`;

export const listAllTables = `
SELECT c.relname, n.nspname,
       c.reltuples::bigint AS est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
ORDER BY n.nspname, c.relname`;

export const listColumns = `
SELECT column_name, data_type, is_nullable, column_default,
       character_maximum_length, numeric_precision, ordinal_position
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position`;

export const listConstraints = `
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = $1::regclass
ORDER BY contype, conname`;

export const listIndexes = `
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = $1 AND tablename = $2
ORDER BY indexname`;

export const listRoles = `
SELECT rolname, rolcanlogin, rolcreatedb, rolcreaterole, rolsuper
FROM pg_roles
WHERE rolname NOT LIKE 'pg\\_%'
ORDER BY rolname`;

export const listActivity = `
SELECT pid, usename, application_name, client_addr::text AS client_addr, state,
       wait_event_type, backend_start::text, query_start::text, state_change::text,
       left(query, 500) AS query
FROM pg_stat_activity
WHERE datname = $1 AND pid <> pg_backend_pid() AND backend_type = 'client backend'
ORDER BY query_start NULLS LAST`;

export const terminateBackend = `
SELECT pg_terminate_backend(pid) AS ok
FROM pg_stat_activity
WHERE datname = $1 AND pid = $2 AND pid <> pg_backend_pid()`;

export const databaseStats = `
SELECT d.datname,
       s.numbackends, s.xact_commit, s.xact_rollback, s.blks_read, s.blks_hit,
       s.tup_returned, s.tup_fetched, s.tup_inserted, s.tup_updated, s.tup_deleted,
       s.deadlocks, s.temp_bytes,
       pg_database_size(d.datname) AS size_bytes
FROM pg_database d
JOIN pg_stat_database s ON s.datid = d.oid
WHERE NOT d.datistemplate AND d.datname NOT IN ('postgres')`;

export const hasStatStatements = `
SELECT count(*)::int AS n FROM pg_extension WHERE extname = 'pg_stat_statements'`;

export const topStatements = `
SELECT d.datname, s.queryid::text AS queryid, left(s.query, 1000) AS query,
       s.calls, s.total_exec_time, s.mean_exec_time, s.rows
FROM pg_stat_statements s
JOIN pg_database d ON d.oid = s.dbid
WHERE d.datname NOT IN ('postgres', 'db_web_meta')
ORDER BY s.total_exec_time DESC
LIMIT $1`;
