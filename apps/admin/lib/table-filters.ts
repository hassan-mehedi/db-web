import { type Filter, isFilterOp, needsValue, type Sort } from "@db-web/sql";

export function parseFilters(raw: string | undefined, columns: string[]): Filter[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.flatMap((f) => {
      if (!Array.isArray(f) || typeof f[0] !== "string" || typeof f[1] !== "string") return [];
      const [column, op, value] = f;
      if (!columns.includes(column) || !isFilterOp(op)) return [];
      return [{ column, op, value: needsValue(op) && typeof value === "string" ? value : "" }];
    });
  } catch {
    return [];
  }
}

export function serializeFilters(filters: Filter[]): string | undefined {
  if (filters.length === 0) return undefined;
  return JSON.stringify(filters.map((f) => [f.column, f.op, f.value]));
}

export function parseSort(raw: string | undefined, columns: string[]): Sort | null {
  if (!raw) return null;
  const desc = raw.startsWith("-");
  const column = desc ? raw.slice(1) : raw;
  return columns.includes(column) ? { column, desc } : null;
}

export function serializeSort(sort: Sort | null): string | undefined {
  return sort ? `${sort.desc ? "-" : ""}${sort.column}` : undefined;
}

export function recordQuery(column: string, value: string): string {
  return new URLSearchParams({
    tab: "data",
    f: serializeFilters([{ column, op: "eq", value }]) ?? "",
  }).toString();
}
