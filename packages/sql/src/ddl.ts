import { quoteIdent, quoteQualified } from "./quote";

const TYPE_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_ ]*(\([0-9]+(, *[0-9]+)?\))?(\[\])*$/;

export function isValidType(type: string): boolean {
  return TYPE_PATTERN.test(type.trim()) && type.trim().length <= 64;
}

export function isSafeExpression(expr: string): boolean {
  return expr.trim().length > 0 && !/;|--|\/\*/.test(expr) && expr.length <= 1000;
}

function type(t: string): string {
  const trimmed = t.trim();
  if (!isValidType(trimmed)) throw new Error(`invalid type: ${t}`);
  return trimmed;
}

function expression(e: string): string {
  if (!isSafeExpression(e)) throw new Error("invalid expression");
  return e.trim();
}

export const FK_ACTIONS = ["NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"] as const;
export type FkAction = (typeof FK_ACTIONS)[number];

export interface ColumnReference {
  schema: string;
  table: string;
  column: string;
  onDelete?: FkAction;
  onUpdate?: FkAction;
}

export interface ColumnSpec {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  references?: ColumnReference;
}

export interface CreateTableInput {
  schema: string;
  name: string;
  columns: ColumnSpec[];
  primaryKey: string[];
}

function action(a: FkAction | undefined, clause: string): string {
  if (!a) return "";
  if (!FK_ACTIONS.includes(a)) throw new Error(`unknown referential action ${a}`);
  return ` ${clause} ${a}`;
}

export function referencesClause(r: ColumnReference): string {
  return `REFERENCES ${quoteQualified(r.schema, r.table)} (${quoteIdent(r.column)})${action(
    r.onDelete,
    "ON DELETE",
  )}${action(r.onUpdate, "ON UPDATE")}`;
}

function columnDef(c: ColumnSpec): string {
  const parts = [quoteIdent(c.name), type(c.type)];
  if (!c.nullable) parts.push("NOT NULL");
  if (c.default) parts.push(`DEFAULT ${expression(c.default)}`);
  if (c.references) parts.push(referencesClause(c.references));
  return parts.join(" ");
}

export function createTable(input: CreateTableInput): string {
  if (input.columns.length === 0) throw new Error("a table needs at least one column");
  const names = new Set(input.columns.map((c) => c.name));
  if (names.size !== input.columns.length) throw new Error("duplicate column name");
  for (const pk of input.primaryKey) {
    if (!names.has(pk)) throw new Error(`primary key column ${pk} is not defined`);
  }
  const lines = input.columns.map(columnDef);
  if (input.primaryKey.length) {
    lines.push(`PRIMARY KEY (${input.primaryKey.map(quoteIdent).join(", ")})`);
  }
  return `CREATE TABLE ${quoteQualified(input.schema, input.name)} (\n  ${lines.join(",\n  ")}\n)`;
}

export function dropTable(schema: string, table: string): string {
  return `DROP TABLE ${quoteQualified(schema, table)}`;
}

export type ColumnChange =
  | { kind: "add"; column: ColumnSpec }
  | { kind: "drop"; column: string }
  | { kind: "rename"; column: string; to: string }
  | { kind: "type"; column: string; type: string; using?: string }
  | { kind: "nullable"; column: string; nullable: boolean }
  | { kind: "default"; column: string; default: string | null }
  | { kind: "reference"; column: string; references: ColumnReference };

export function alterColumn(schema: string, table: string, change: ColumnChange): string {
  const rel = quoteQualified(schema, table);
  switch (change.kind) {
    case "add":
      return `ALTER TABLE ${rel} ADD COLUMN ${columnDef(change.column)}`;
    case "drop":
      return `ALTER TABLE ${rel} DROP COLUMN ${quoteIdent(change.column)}`;
    case "rename":
      return `ALTER TABLE ${rel} RENAME COLUMN ${quoteIdent(change.column)} TO ${quoteIdent(change.to)}`;
    case "type": {
      const using = change.using ? ` USING ${expression(change.using)}` : "";
      return `ALTER TABLE ${rel} ALTER COLUMN ${quoteIdent(change.column)} TYPE ${type(change.type)}${using}`;
    }
    case "nullable":
      return `ALTER TABLE ${rel} ALTER COLUMN ${quoteIdent(change.column)} ${change.nullable ? "DROP" : "SET"} NOT NULL`;
    case "default":
      return change.default === null
        ? `ALTER TABLE ${rel} ALTER COLUMN ${quoteIdent(change.column)} DROP DEFAULT`
        : `ALTER TABLE ${rel} ALTER COLUMN ${quoteIdent(change.column)} SET DEFAULT ${expression(change.default)}`;
    case "reference":
      return `ALTER TABLE ${rel} ADD FOREIGN KEY (${quoteIdent(change.column)}) ${referencesClause(change.references)}`;
  }
}

export function alterColumns(schema: string, table: string, changes: ColumnChange[]): string[] {
  return changes.map((c) => alterColumn(schema, table, c));
}
