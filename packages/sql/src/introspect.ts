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

export const listTables = `
SELECT c.relname, n.nspname,
       c.reltuples::bigint AS est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p') AND n.nspname = $1
ORDER BY c.relname`;

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
