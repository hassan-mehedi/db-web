"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRowsAction, updateRowAction } from "@/app/actions/data";
import { FormError } from "@/components/form-error";
import { Grid, type GridColumn } from "@/components/grid";
import { InsertRowDialog } from "@/components/insert-row-dialog";
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [inserting, setInserting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const keyOf = (row: Cell[]): RowKey =>
    Object.fromEntries(primaryKey.map((k) => [k, row[columns.indexOf(k)] ?? null]));

  const defs: GridColumn[] = columns.map((name) => ({
    name,
    type: columnMeta.find((m) => m.column_name === name)?.data_type,
    primaryKey: primaryKey.includes(name),
    editable,
  }));

  async function onEdit(r: number, c: number, value: Cell) {
    const row = rows[r];
    const col = columns[c];
    if (!row || !col) return false;
    setError(null);
    const res = await updateRowAction(rel, keyOf(row), { [col]: value });
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  function remove() {
    setError(null);
    start(async () => {
      const keys = [...selected]
        .map((i) => rows[i])
        .filter((r): r is Cell[] => !!r)
        .map(keyOf);
      const res = await deleteRowsAction(rel, keys);
      if (!res.ok) setError(res.error);
      else setSelected(new Set());
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <>
            <Button size="sm" onClick={() => setInserting(true)}>
              <Plus />
              Insert row
            </Button>
            {selected.size > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete {selected.size} row{selected.size === 1 ? "" : "s"}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Double-click or press Enter on a cell to edit. Backspace sets NULL.
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            No primary key, so rows are read-only here. Use the SQL editor.
          </span>
        )}
      </div>
      <FormError error={error} mono />
      <Grid
        columns={defs}
        rows={rows}
        {...(editable ? { selected, onSelect: setSelected, onEdit } : {})}
        className="max-h-[70vh]"
      />

      {inserting && (
        <InsertRowDialog
          rel={rel}
          columns={columnMeta}
          primaryKey={primaryKey}
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
              .filter((r): r is Cell[] => !!r)
              .map(
                (r) =>
                  `DELETE FROM ${rel.schema}.${rel.table} WHERE ${Object.entries(keyOf(r))
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
