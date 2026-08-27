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

const DEFAULTS_BY_TYPE: [RegExp, string[]][] = [
  [/^uuid$/, ["gen_random_uuid()"]],
  [/^timestamp/, ["now()", "CURRENT_TIMESTAMP"]],
  [/^date$/, ["CURRENT_DATE", "now()"]],
  [/^time/, ["CURRENT_TIME", "now()"]],
  [/^bool/, ["false", "true"]],
  [/^(small|big)?int|^int[248]$|^numeric|^real|^double|^decimal/, ["0"]],
  [/^jsonb?$/, ["'{}'", "'[]'"]],
  [/^(text|varchar|character varying|char)/, ["''"]],
  [/\[\]$/, ["'{}'"]],
];

export function defaultSuggestions(type: string): string[] {
  const t = type.trim().toLowerCase();
  const match = DEFAULTS_BY_TYPE.find(([re]) => re.test(t));
  return match ? match[1] : [];
}
