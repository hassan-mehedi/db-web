import { isSafeExpression } from "./ddl";
import { quoteIdent, quoteQualified } from "./quote";

export const INDEX_METHODS = ["btree", "hash", "gin", "gist", "brin"] as const;
export type IndexMethod = (typeof INDEX_METHODS)[number];

export interface CreateIndexInput {
  schema: string;
  table: string;
  name?: string;
  columns: string[];
  unique: boolean;
  method: IndexMethod;
}

function nonEmpty(cols: string[], what: string) {
  if (cols.length === 0) throw new Error(`${what} needs at least one column`);
  if (new Set(cols).size !== cols.length) throw new Error(`${what} has duplicate columns`);
}

export function defaultIndexName(table: string, columns: string[], unique: boolean): string {
  return `${table}_${columns.join("_")}_${unique ? "key" : "idx"}`.slice(0, 63);
}

export function createIndex(input: CreateIndexInput): string {
  nonEmpty(input.columns, "index");
  if (!INDEX_METHODS.includes(input.method)) throw new Error(`unknown method ${input.method}`);
  const name = input.name || defaultIndexName(input.table, input.columns, input.unique);
  return `CREATE ${input.unique ? "UNIQUE " : ""}INDEX ${quoteIdent(name)} ON ${quoteQualified(
    input.schema,
    input.table,
  )} USING ${input.method} (${input.columns.map(quoteIdent).join(", ")})`;
}

export function dropIndex(schema: string, name: string): string {
  return `DROP INDEX ${quoteQualified(schema, name)}`;
}

export const FK_ACTIONS = ["NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"] as const;
export type FkAction = (typeof FK_ACTIONS)[number];

export interface AddForeignKeyInput {
  schema: string;
  table: string;
  name?: string;
  columns: string[];
  refSchema: string;
  refTable: string;
  refColumns: string[];
  onDelete: FkAction;
  onUpdate: FkAction;
}

export function addForeignKey(input: AddForeignKeyInput): string {
  nonEmpty(input.columns, "foreign key");
  if (input.columns.length !== input.refColumns.length) {
    throw new Error("foreign key column count must match referenced columns");
  }
  if (!FK_ACTIONS.includes(input.onDelete) || !FK_ACTIONS.includes(input.onUpdate)) {
    throw new Error("unknown referential action");
  }
  const name = input.name || `${input.table}_${input.columns.join("_")}_fkey`.slice(0, 63);
  return `ALTER TABLE ${quoteQualified(input.schema, input.table)} ADD CONSTRAINT ${quoteIdent(
    name,
  )} FOREIGN KEY (${input.columns.map(quoteIdent).join(", ")}) REFERENCES ${quoteQualified(
    input.refSchema,
    input.refTable,
  )} (${input.refColumns.map(quoteIdent).join(", ")}) ON DELETE ${input.onDelete} ON UPDATE ${input.onUpdate}`;
}

export interface AddUniqueInput {
  schema: string;
  table: string;
  name?: string;
  columns: string[];
}

export function addUnique(input: AddUniqueInput): string {
  nonEmpty(input.columns, "unique constraint");
  const name = input.name || defaultIndexName(input.table, input.columns, true);
  return `ALTER TABLE ${quoteQualified(input.schema, input.table)} ADD CONSTRAINT ${quoteIdent(
    name,
  )} UNIQUE (${input.columns.map(quoteIdent).join(", ")})`;
}

export interface AddCheckInput {
  schema: string;
  table: string;
  name: string;
  expression: string;
}

export function addCheck(input: AddCheckInput): string {
  if (!isSafeExpression(input.expression)) throw new Error("invalid check expression");
  return `ALTER TABLE ${quoteQualified(input.schema, input.table)} ADD CONSTRAINT ${quoteIdent(
    input.name,
  )} CHECK (${input.expression.trim()})`;
}

export function dropConstraint(schema: string, table: string, name: string): string {
  return `ALTER TABLE ${quoteQualified(schema, table)} DROP CONSTRAINT ${quoteIdent(name)}`;
}
