"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useState, useTransition } from "react";
import { deleteRowsAction, insertRowAction, updateRowAction } from "@/app/actions/data";
import { SqlPreview } from "@/components/sql-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { Rel, RowKey } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import type { ColumnRow } from "@/lib/queries";

interface Props {
  rel: Rel;
  columns: string[];
  columnMeta: ColumnRow[];
  rows: Cell[][];
  primaryKey: string[];
}

export function DataGrid({ rel, columns, columnMeta, rows, primaryKey }: Props) {
  const router = useRouter();
  const editable = primaryKey.length > 0;
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [inserting, setInserting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const keyOf = (row: Cell[]): RowKey =>
    Object.fromEntries(primaryKey.map((k) => [k, row[columns.indexOf(k)] ?? null]));

  function startEdit(r: number, c: number) {
    if (!editable) return;
    setEditing({ row: r, col: c });
    setDraft(rows[r]?.[c] ?? "");
  }

  function commit(asNull: boolean) {
    if (!editing) return;
    const row = rows[editing.row];
    const col = columns[editing.col];
    if (!row || !col) return;
    const next: Cell = asNull ? null : draft;
    if (next === row[editing.col]) {
      setEditing(null);
      return;
    }
    setError(null);
    start(async () => {
      const res = await updateRowAction(rel, keyOf(row), { [col]: next });
      if (!res.ok) setError(res.error);
      setEditing(null);
      router.refresh();
    });
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit(false);
    if (e.key === "Escape") setEditing(null);
  }

  function remove() {
    setError(null);
    start(async () => {
      const keys = [...selected]
        .map((i) => rows[i])
        .filter(Boolean)
        .map((r) => keyOf(r as Cell[]));
      const res = await deleteRowsAction(rel, keys);
      if (!res.ok) setError(res.error);
      else setSelected(new Set());
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        {editable ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setInserting(true)}>
              Insert row
            </Button>
            {selected.size > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete {selected.size} row{selected.size === 1 ? "" : "s"}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Click a cell to edit. Enter saves, Esc cancels.
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            No primary key, so rows are read-only here. Use the SQL editor.
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {editable && <TableHead className="w-8" />}
              {columns.map((c) => (
                <TableHead key={c} className="font-mono">
                  {c}
                  {primaryKey.includes(c) && <span className="ml-1 text-muted-foreground">pk</span>}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: page rows are positional
              <TableRow key={r} data-state={selected.has(r) ? "selected" : undefined}>
                {editable && (
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label="select row"
                      checked={selected.has(r)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(r);
                        else next.delete(r);
                        setSelected(next);
                      }}
                    />
                  </TableCell>
                )}
                {row.map((cell, c) => {
                  const isEditing = editing?.row === r && editing.col === c;
                  return (
                    <TableCell
                      key={columns[c]}
                      className={`max-w-xs font-mono text-xs ${isEditing ? "" : "truncate"} ${editable ? "cursor-text" : ""}`}
                      title={cell ?? ""}
                      onDoubleClick={() => startEdit(r, c)}
                      onClick={() => !isEditing && startEdit(r, c)}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            className="h-7 font-mono text-xs"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={onKey}
                            onBlur={() => commit(false)}
                            disabled={pending}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => commit(true)}
                          >
                            null
                          </Button>
                        </div>
                      ) : cell === null ? (
                        <span className="text-muted-foreground">null</span>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {inserting && (
        <InsertRowDialog
          rel={rel}
          columns={columnMeta}
          onClose={() => setInserting(false)}
          onDone={() => {
            setInserting(false);
            router.refresh();
          }}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selected.size} row{selected.size === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Rows are matched on {primaryKey.join(", ")}. Runs in one transaction.
            </DialogDescription>
          </DialogHeader>
          <SqlPreview
            sql={[...selected]
              .map((i) => rows[i])
              .filter(Boolean)
              .map(
                (r) =>
                  `DELETE FROM ${rel.schema}.${rel.table} WHERE ${Object.entries(keyOf(r as Cell[]))
                    .map(([k, v]) => `${k} = ${v === null ? "NULL" : `'${v}'`}`)
                    .join(" AND ")};`,
              )
              .join("\n")}
          />
          <DialogFooter>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsertRowDialog({
  rel,
  columns,
  onClose,
  onDone,
}: {
  rel: Rel;
  columns: ColumnRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<
    Record<string, { mode: "default" | "null" | "value"; text: string }>
  >(Object.fromEntries(columns.map((c) => [c.column_name, { mode: "default", text: "" }])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const payload: Record<string, Cell> = {};
    for (const [col, v] of Object.entries(values)) {
      if (v.mode === "null") payload[col] = null;
      else if (v.mode === "value") payload[col] = v.text;
    }
    setError(null);
    start(async () => {
      const res = await insertRowAction(rel, payload);
      if (!res.ok) setError(res.error);
      else onDone();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Insert row</DialogTitle>
          <DialogDescription>Leave a field on "default" to let Postgres fill it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {columns.map((c) => {
            const v = values[c.column_name] ?? { mode: "default" as const, text: "" };
            return (
              <div key={c.column_name} className="grid grid-cols-[1fr_2fr_auto] items-center gap-2">
                <Label className="font-mono text-xs">
                  {c.column_name}
                  <span className="block text-muted-foreground">{c.data_type}</span>
                </Label>
                <Input
                  className="font-mono"
                  value={v.text}
                  disabled={v.mode !== "value"}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [c.column_name]: { mode: "value", text: e.target.value },
                    })
                  }
                />
                <select
                  className="rounded border bg-background p-1 text-xs"
                  value={v.mode}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [c.column_name]: {
                        mode: e.target.value as "default" | "null" | "value",
                        text: v.text,
                      },
                    })
                  }
                >
                  <option value="default">default</option>
                  <option value="null">null</option>
                  <option value="value">value</option>
                </select>
              </div>
            );
          })}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Inserting…" : "Insert"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
