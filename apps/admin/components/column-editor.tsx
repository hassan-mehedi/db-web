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
import type { ColumnRow, CompletionSchema } from "@/lib/queries";

interface Props {
  database: string;
  schema: string;
  table: string;
  columns: ColumnRow[];
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

export function ColumnEditor({ database, schema, table, columns, tables }: Props) {
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.nullable}
                onChange={(e) => setDraft({ ...draft, nullable: e.target.checked })}
              />
              Nullable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!draft.references}
                onChange={(e) => {
                  const { references, ...rest } = draft;
                  setDraft(
                    e.target.checked
                      ? { ...rest, references: references ?? firstReference(tables, schema) }
                      : rest,
                  );
                }}
              />
              Foreign key
            </label>
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
          onChange={(c) => {
            push(c);
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

function EditColumnDialog({
  database,
  schema,
  tables,
  column,
  onClose,
  onChange,
}: {
  database: string;
  schema: string;
  tables: CompletionSchema;
  column: ColumnRow;
  onClose: () => void;
  onChange: (c: ColumnChange) => void;
}) {
  const name = column.column_name;
  const [rename, setRename] = useState(name);
  const [type, setType] = useState("");
  const [using, setUsing] = useState("");
  const [def, setDef] = useState(column.column_default ?? "");
  const [reference, setReference] = useState<ColumnReference>(() => firstReference(tables, schema));
  const nullable = column.is_nullable === "YES";
  const hasTables = Object.values(tables).some((t) => Object.keys(t).length > 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <div className="grid gap-1">
            <Label htmlFor="edit-rename">Rename</Label>
            <div className="flex gap-2">
              <Input
                id="edit-rename"
                className="font-mono"
                value={rename}
                onChange={(e) => setRename(e.target.value.trim())}
              />
              <Button
                variant="outline"
                disabled={rename === name || !/^[a-z_][a-z0-9_]*$/.test(rename)}
                onClick={() => onChange({ kind: "rename", column: name, to: rename })}
              >
                Queue
              </Button>
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="edit-type">Change type (current: {column.data_type})</Label>
            <div className="flex gap-2">
              <TypeInput
                id="edit-type"
                database={database}
                placeholder="bigint"
                value={type}
                onChange={setType}
              />
              <Input
                className="font-mono"
                placeholder={`USING ${name}::bigint`}
                value={using}
                onChange={(e) => setUsing(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!isValidType(type) || (using !== "" && !isSafeExpression(using))}
                onClick={() =>
                  onChange({ kind: "type", column: name, type, ...(using ? { using } : {}) })
                }
              >
                Queue
              </Button>
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="edit-default">
              Default (current: {column.column_default ?? "none"})
            </Label>
            <div className="flex gap-2">
              <Input
                id="edit-default"
                className="font-mono"
                value={def}
                onChange={(e) => setDef(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!isSafeExpression(def) || def === column.column_default}
                onClick={() => onChange({ kind: "default", column: name, default: def })}
              >
                Set
              </Button>
              <Button
                variant="outline"
                disabled={!column.column_default}
                onClick={() => onChange({ kind: "default", column: name, default: null })}
              >
                Drop
              </Button>
            </div>
          </div>
          <div>
            <Button
              variant="outline"
              onClick={() => onChange({ kind: "nullable", column: name, nullable: !nullable })}
            >
              {nullable ? "Set NOT NULL" : "Drop NOT NULL"}
            </Button>
          </div>
          {hasTables && (
            <div className="grid gap-2">
              <span>Foreign key</span>
              <ReferencePicker
                tables={tables}
                value={reference}
                onChange={setReference}
                idPrefix="edit-fk"
              />
              <div>
                <Button
                  variant="outline"
                  onClick={() =>
                    onChange({ kind: "reference", column: name, references: reference })
                  }
                >
                  Queue
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
