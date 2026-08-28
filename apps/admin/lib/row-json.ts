import type { Cell } from "./format";

export function rowObject(columns: string[], row: Cell[]): Record<string, Cell> {
  return Object.fromEntries(columns.map((c, i) => [c, row[i] ?? null]));
}

export function prettyCell(value: string): string {
  if (!/^\s*[[{]/.test(value)) return value;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
