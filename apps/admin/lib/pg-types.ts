export const COMMON_TYPES = [
  "bigint",
  "boolean",
  "bytea",
  "date",
  "double precision",
  "integer",
  "interval",
  "json",
  "jsonb",
  "numeric",
  "numeric(12,2)",
  "real",
  "serial",
  "smallint",
  "text",
  "text[]",
  "time",
  "timestamp",
  "timestamptz",
  "uuid",
  "varchar(255)",
  "vector(1536)",
] as const;

export const IDENTITY_TYPE = "bigint generated always as identity";
export const CREATE_TYPES = [...COMMON_TYPES, IDENTITY_TYPE] as const;
