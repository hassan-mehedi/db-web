import { quoteIdent } from "./quote";

export const FILTER_OPS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "in",
  "null",
  "notnull",
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const FILTER_OP_LABELS: Record<FilterOp, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
  in: "in",
  null: "is null",
  notnull: "is not null",
};

export interface Filter {
  column: string;
  op: FilterOp;
  value: string;
}

export interface Sort {
  column: string;
  desc: boolean;
}

export function isFilterOp(op: string): op is FilterOp {
  return (FILTER_OPS as readonly string[]).includes(op);
}

export function needsValue(op: FilterOp): boolean {
  return op !== "null" && op !== "notnull";
}

const COMPARE: Partial<Record<FilterOp, string>> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

export function filterWhere(
  filters: Filter[],
  startAt = 1,
  prefix = "",
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const parts = filters.map((f) => {
    const col = `${prefix}${quoteIdent(f.column)}`;
    const next = () => `$${startAt + params.length}`;
    switch (f.op) {
      case "null":
        return `${col} IS NULL`;
      case "notnull":
        return `${col} IS NOT NULL`;
      case "like":
      case "ilike": {
        const p = next();
        params.push(f.value);
        return `${col}::text ${f.op.toUpperCase()} ${p}`;
      }
      case "in": {
        const p = next();
        params.push(
          f.value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        );
        return `${col}::text = ANY(${p}::text[])`;
      }
      default: {
        const p = next();
        params.push(f.value);
        return `${col} ${COMPARE[f.op]} ${p}`;
      }
    }
  });
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

export function orderBy(sort: Sort | null, tieBreak: string[], prefix = ""): string {
  const cols: string[] = [];
  if (sort) cols.push(`${prefix}${quoteIdent(sort.column)}${sort.desc ? " DESC" : ""} NULLS LAST`);
  for (const k of tieBreak) {
    if (k !== sort?.column) cols.push(`${prefix}${quoteIdent(k)}`);
  }
  return cols.length ? `ORDER BY ${cols.join(", ")}` : "";
}
