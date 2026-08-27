"use client";

import {
  alterColumns,
  type ColumnChange,
  type ColumnReference,
  isSafeExpression,
  isValidType,
} from "@db-web/sql";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { alterColumnsAction } from "@/app/actions/schema";
import { FormError } from "@/components/form-error";
import { firstReference, ReferencePicker } from "@/components/reference-picker";
import { SqlPreview } from "@/components/sql-preview";
import { TypeInput } from "@/components/type-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ColumnRow, CompletionSchema, ForeignKeyRow } from "@/lib/queries";

interface Props {
  database: string;
  schema: string;
  table: string;
  columns: ColumnRow[];
  foreignKeys: ForeignKeyRow[];
  tables: CompletionSchema;
}

type Draft = {
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  references?: ColumnReference;
};
const emptyDraft: Draft = { name: "", type: "text", nullable: true, default: "" };

function describeReference(r: ColumnReference): string {
  return `${r.schema}.${r.table}(${r.column})`;
}

function describe(c: ColumnChange): string {
  switch (c.kind) {
    case "add":
      return `add ${c.column.name} ${c.column.type}`;
    case "drop":
      return `drop ${c.column}`;
    case "rename":
      return `rename ${c.column} → ${c.to}`;
    case "type":
      return `${c.column} type → ${c.type}${c.using ? ` using ${c.using}` : ""}`;
    case "nullable":
      return `${c.column} ${c.nullable ? "nullable" : "not null"}`;
    case "default":
      return `${c.column} default ${c.default === null ? "dropped" : `→ ${c.default}`}`;
    case "reference":
      return `${c.column} → ${describeReference(c.references)}`;
  }
}

export function ColumnEditor({ database, schema, table, columns, foreignKeys, tables }: Props) {
  const router = useRouter();
  const [changes, setChanges] = useState<ColumnChange[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ColumnRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sql = useMemo(() => {
    try {
      return `${alterColumns(schema, table, changes).join(";\n")};`;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }, [schema, table, changes]);

  const push = (c: ColumnChange) => setChanges((prev) => [...prev, c]);

  function apply() {
    setError(null);
    start(async () => {
      const res = await alterColumnsAction(database, schema, table, changes);
      if (!res.ok) setError(res.error);
      else {
        setChanges([]);
        setConfirming(false);
        router.refresh();
      }
    });
  }

  const draftValid =
    /^[a-z_][a-z0-9_]*$/.test(draft.name) &&
    isValidType(draft.type) &&
    (draft.default === "" || isSafeExpression(draft.default));

  return (
    <div className="grid gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Nullable</TableHead>
            <TableHead>Default</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((c) => (
            <TableRow key={c.column_name}>
              <TableCell className="font-mono">{c.column_name}</TableCell>
              <TableCell className="font-mono text-xs">
                {c.data_type}
                {c.character_maximum_length ? `(${c.character_maximum_length})` : ""}
              </TableCell>
              <TableCell>{c.is_nullable === "YES" ? "yes" : "no"}</TableCell>
              <TableCell className="font-mono text-xs">{c.column_default ?? ""}</TableCell>
              <TableCell className="space-x-2 text-right whitespace-nowrap">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => push({ kind: "drop", column: c.column_name })}
                >
                  Drop
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          Add column
        </Button>
        {changes.length > 0 && (
          <>
            <Button size="sm" onClick={() => setConfirming(true)}>
              Review {changes.length} change{changes.length === 1 ? "" : "s"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChanges([])}>
              Discard
            </Button>
          </>
        )}
      </div>

      {changes.length > 0 && (
        <ul className="text-sm text-muted-foreground">
          {changes.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: pending list is append-only
            <li key={i} className="flex items-center gap-2 font-mono text-xs">
              {describe(c)}
              <button
                type="button"
                className="hover:text-destructive"
                onClick={() => setChanges((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add column</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="col-name">Name</Label>
              <Input
                id="col-name"
                className="font-mono"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value.trim() })}
                autoFocus
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="col-type">Type</Label>
              <TypeInput
                id="col-type"
                database={database}
                value={draft.type}
                onChange={(type) => setDraft({ ...draft, type })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="col-default">Default expression (optional)</Label>
              <Input
                id="col-default"
                className="font-mono"
                placeholder="now()"
                value={draft.default}
                onChange={(e) => setDraft({ ...draft, default: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="col-nullable"
                checked={draft.nullable}
                onCheckedChange={(c) => setDraft({ ...draft, nullable: c === true })}
              />
              <Label htmlFor="col-nullable">Nullable</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="col-fk"
                checked={!!draft.references}
                onCheckedChange={(c) => {
                  const { references, ...rest } = draft;
                  setDraft(
                    c === true
                      ? { ...rest, references: references ?? firstReference(tables, schema) }
                      : rest,
                  );
                }}
              />
              <Label htmlFor="col-fk">Foreign key</Label>
            </div>
            {draft.references && (
              <ReferencePicker
                tables={tables}
                value={draft.references}
                onChange={(references) => setDraft({ ...draft, references })}
                idPrefix="add-fk"
              />
            )}
            <DialogFooter>
              <Button
                disabled={!draftValid}
                onClick={() => {
                  push({
                    kind: "add",
                    column: {
                      name: draft.name,
                      type: draft.type,
                      nullable: draft.nullable,
                      ...(draft.default ? { default: draft.default } : {}),
                      ...(draft.references ? { references: draft.references } : {}),
                    },
                  });
                  setDraft(emptyDraft);
                  setAdding(false);
                }}
              >
                Add to changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {editing && (
        <EditColumnDialog
          database={database}
          schema={schema}
          tables={tables}
          column={editing}
          onClose={() => setEditing(null)}
          foreignKey={foreignKeys.find((f) => f.column === editing.column_name)}
          onSave={(cs) => {
            setChanges((prev) => [...prev, ...cs]);
            setEditing(null);
          }}
        />
      )}

      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply to {table}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <SqlPreview sql={sql} />
            <p className="text-xs text-muted-foreground">Runs in one transaction.</p>
            <FormError error={error} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
                Back
              </Button>
              <Button onClick={apply} disabled={pending}>
                {pending ? "Applying…" : "Apply"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function currentType(column: ColumnRow): string {
  if (column.data_type === "character varying" && column.character_maximum_length) {
    return `varchar(${column.character_maximum_length})`;
  }
  return column.data_type;
}

function EditColumnDialog({
  database,
  schema,
  tables,
  column,
  foreignKey,
  onClose,
  onSave,
}: {
  database: string;
  schema: string;
  tables: CompletionSchema;
  column: ColumnRow;
  foreignKey: ForeignKeyRow | undefined;
  onClose: () => void;
  onSave: (changes: ColumnChange[]) => void;
}) {
  const name = column.column_name;
  const initial = {
    name,
    type: currentType(column),
    nullable: column.is_nullable === "YES",
    default: column.column_default ?? "",
  };
  const [form, setForm] = useState(initial);
  const [using, setUsing] = useState("");
  const [reference, setReference] = useState<ColumnReference | null>(null);
  const hasTables = Object.values(tables).some((t) => Object.keys(t).length > 0);
  const typeChanged = form.type.trim() !== initial.type;

  const changes: ColumnChange[] = [];
  if (typeChanged) {
    changes.push({ kind: "type", column: name, type: form.type, ...(using ? { using } : {}) });
  }
  if (form.nullable !== initial.nullable) {
    changes.push({ kind: "nullable", column: name, nullable: form.nullable });
  }
  if (form.default !== initial.default) {
    changes.push({ kind: "default", column: name, default: form.default || null });
  }
  if (reference) changes.push({ kind: "reference", column: name, references: reference });
  if (form.name !== name) changes.push({ kind: "rename", column: name, to: form.name });

  const valid =
    /^[a-z_][a-z0-9_]*$/.test(form.name) &&
    isValidType(form.type) &&
    !/\bgenerated\b/i.test(form.type) &&
    (using === "" || isSafeExpression(using)) &&
    (form.default === "" || isSafeExpression(form.default));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              className="font-mono"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.trim() })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="edit-type">Type</Label>
            <TypeInput
              id="edit-type"
              database={database}
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
            />
          </div>
          {typeChanged && (
            <div className="grid gap-1">
              <Label htmlFor="edit-using">Convert existing values with (optional)</Label>
              <Input
                id="edit-using"
                className="font-mono"
                placeholder={`${name}::${form.type.trim() || "bigint"}`}
                value={using}
                onChange={(e) => setUsing(e.target.value)}
              />
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="edit-default">Default expression (empty for none)</Label>
            <Input
              id="edit-default"
              className="font-mono"
              placeholder="now()"
              value={form.default}
              onChange={(e) => setForm({ ...form, default: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-nullable"
              checked={form.nullable}
              onCheckedChange={(c) => setForm({ ...form, nullable: c === true })}
            />
            <Label htmlFor="edit-nullable">Nullable</Label>
          </div>
          {foreignKey ? (
            <p className="text-muted-foreground">
              References{" "}
              <span className="font-mono">
                {foreignKey.refSchema}.{foreignKey.refTable}({foreignKey.refColumn})
              </span>
              . Change or drop it from the Constraints tab.
            </p>
          ) : (
            hasTables && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-fk"
                    checked={reference !== null}
                    onCheckedChange={(c) =>
                      setReference(c === true ? firstReference(tables, schema) : null)
                    }
                  />
                  <Label htmlFor="edit-fk">Foreign key</Label>
                </div>
                {reference && (
                  <ReferencePicker
                    tables={tables}
                    value={reference}
                    onChange={setReference}
                    idPrefix="edit-fk"
                  />
                )}
              </>
            )
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!valid || changes.length === 0} onClick={() => onSave(changes)}>
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
