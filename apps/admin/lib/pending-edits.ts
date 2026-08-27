import { quoteIdent, quoteLiteral, quoteQualified } from "@db-web/sql";
import type { Rel, RowChange, RowKey } from "./dml";
import type { Cell } from "./format";

export type PendingEdits = Map<string, Cell>;

export function editKey(row: number, col: number) {
  return `${row}:${col}`;
}

export function groupEdits(
  edits: PendingEdits,
  rows: Cell[][],
  columnName: (col: number) => string | null,
  keyOf: (row: Cell[]) => RowKey,
): RowChange[] {
  const byRow = new Map<number, Record<string, Cell>>();
  for (const [k, value] of edits) {
    const [r, c] = k.split(":").map(Number);
    if (r === undefined || c === undefined) continue;
    const name = columnName(c);
    if (name === null) continue;
    const values = byRow.get(r) ?? {};
    values[name] = value;
    byRow.set(r, values);
  }
  return [...byRow]
    .filter(([r]) => rows[r] !== undefined)
    .map(([r, values]) => ({ key: keyOf(rows[r] as Cell[]), values }));
}

export function previewUpdates(rel: Rel, changes: RowChange[]) {
  return changes
    .map((ch) => {
      const set = Object.entries(ch.values)
        .map(([c, v]) => `${quoteIdent(c)} = ${quoteLiteral(v)}`)
        .join(", ");
      const where = Object.entries(ch.key)
        .map(([c, v]) =>
          v === null ? `${quoteIdent(c)} IS NULL` : `${quoteIdent(c)} = ${quoteLiteral(v)}`,
        )
        .join(" AND ");
      return `UPDATE ${quoteQualified(rel.schema, rel.table)} SET ${set} WHERE ${where};`;
    })
    .join("\n");
}
