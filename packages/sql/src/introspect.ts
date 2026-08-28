export const listDatabaseNames = `
SELECT d.datname
FROM pg_database d
WHERE NOT d.datistemplate AND d.datname NOT IN ('postgres', 'db_web_meta')
ORDER BY d.datname`;

export const listDatabasesWithConnections = `
SELECT d.datname, coalesce(a.n, 0)::int AS connections
FROM pg_database d
LEFT JOIN (SELECT datname, count(*) AS n FROM pg_stat_activity GROUP BY datname) a
  ON a.datname = d.datname
WHERE NOT d.datistemplate AND d.datname NOT IN ('postgres', 'db_web_meta')
ORDER BY d.datname`;

export const databaseSizes = `
SELECT datname, pg_database_size(datname) AS size_bytes, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database WHERE datname = ANY($1::text[])`;

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
SELECT column_name, data_type, is_nullable, column_default, is_identity, identity_generation,
       character_maximum_length, numeric_precision, ordinal_position
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position`;

export const listConstraints = `
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = $1::regclass
ORDER BY contype, conname`;

export const singleColumnForeignKeys = `
SELECT c.conrelid::int AS relid, c.conkey[1] AS attnum, a.attname AS column,
       rn.nspname AS "refSchema", rc.relname AS "refTable", ra.attname AS "refColumn"
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
JOIN pg_class rc ON rc.oid = c.confrelid
JOIN pg_namespace rn ON rn.oid = rc.relnamespace
JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
WHERE c.conrelid = ANY($1::regclass[]) AND c.contype = 'f' AND array_length(c.conkey, 1) = 1`;

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

export const databaseAccess = `
SELECT pg_get_userbyid(d.datdba) AS owner,
       current_user AS "user",
       has_schema_privilege('public', 'CREATE') AS "canCreateInPublic"
FROM pg_database d WHERE d.datname = current_database()`;

export const completionSchema = `
SELECT table_schema AS schema, table_name AS "table",
       array_agg(column_name::text ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema NOT LIKE 'pg\\_%' AND table_schema <> 'information_schema'
GROUP BY 1, 2 ORDER BY 1, 2`;

export const listTriggers = `
SELECT t.tgname AS name, t.tgenabled <> 'D' AS enabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal
ORDER BY t.tgname`;

export const listPolicies = `
SELECT p.policyname AS name, p.cmd, p.permissive = 'PERMISSIVE' AS permissive,
       p.roles::text[] AS roles, p.qual AS "using", p.with_check AS "withCheck"
FROM pg_policies p
WHERE p.schemaname = $1 AND p.tablename = $2
ORDER BY p.policyname`;

export const rowSecurity = `
SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
FROM pg_class c WHERE c.oid = $1::regclass`;

export const tableDependencies = `
SELECT 'fk' AS kind, n.nspname AS schema, c.relname AS name, con.conname AS detail
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE con.confrelid = $1::regclass AND con.contype = 'f'
UNION ALL
SELECT DISTINCT CASE v.relkind WHEN 'm' THEN 'matview' ELSE 'view' END, vn.nspname, v.relname, NULL
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class v ON v.oid = r.ev_class
JOIN pg_namespace vn ON vn.oid = v.relnamespace
WHERE d.refobjid = $1::regclass AND d.classid = 'pg_rewrite'::regclass AND v.oid <> $1::regclass
ORDER BY 1, 2, 3`;

export const tableStats = `
SELECT s.n_live_tup::bigint AS live, s.n_dead_tup::bigint AS dead,
       s.seq_scan::bigint AS seq_scan, s.idx_scan::bigint AS idx_scan,
       s.last_vacuum::text, s.last_autovacuum::text, s.last_analyze::text, s.last_autoanalyze::text,
       pg_total_relation_size(s.relid) AS total_bytes,
       pg_relation_size(s.relid) AS table_bytes,
       pg_indexes_size(s.relid) AS index_bytes
FROM pg_stat_user_tables s
WHERE s.relid = $1::regclass`;

export const bloatedTables = `
SELECT s.schemaname AS schema, s.relname AS table,
       s.n_live_tup::bigint AS live, s.n_dead_tup::bigint AS dead,
       CASE WHEN s.n_live_tup + s.n_dead_tup = 0 THEN 0
            ELSE round(100.0 * s.n_dead_tup / (s.n_live_tup + s.n_dead_tup), 1) END AS dead_pct,
       s.seq_scan::bigint AS seq_scan, s.idx_scan::bigint AS idx_scan,
       coalesce(s.last_autovacuum, s.last_vacuum)::text AS last_vacuum,
       pg_total_relation_size(s.relid) AS total_bytes
FROM pg_stat_user_tables s
ORDER BY s.n_dead_tup DESC, pg_total_relation_size(s.relid) DESC
LIMIT $1`;

export const unusedIndexes = `
SELECT s.schemaname AS schema, s.relname AS table, s.indexrelname AS index,
       s.idx_scan::bigint AS scans, pg_relation_size(s.indexrelid) AS bytes
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE NOT i.indisunique AND NOT i.indisprimary AND s.idx_scan < $1
ORDER BY pg_relation_size(s.indexrelid) DESC
LIMIT $2`;

export const lockWaits = `
SELECT w.pid AS waiting_pid, w.usename AS waiting_user, left(w.query, 300) AS waiting_query,
       w.wait_event_type, w.wait_event,
       extract(epoch FROM now() - w.query_start)::int AS waiting_seconds,
       b.pid AS blocking_pid, b.usename AS blocking_user, b.state AS blocking_state,
       left(b.query, 300) AS blocking_query
FROM pg_stat_activity w
JOIN LATERAL unnest(pg_blocking_pids(w.pid)) AS bp(pid) ON true
JOIN pg_stat_activity b ON b.pid = bp.pid
WHERE w.datname = current_database() AND cardinality(pg_blocking_pids(w.pid)) > 0
ORDER BY w.query_start`;
