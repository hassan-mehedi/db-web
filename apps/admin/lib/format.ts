export type Cell = string | null;

export function formatCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `\\x${value.toString("hex")}`;
  return JSON.stringify(value);
}

export function formatRows(rows: unknown[][]): Cell[][] {
  return rows.map((row) => row.map(formatCell));
}
