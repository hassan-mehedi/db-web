"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { deleteRowsAction, updateRowsAction } from "@/app/actions/data";
import { FormError } from "@/components/form-error";
import { Grid, type GridColumn } from "@/components/grid";
import { InsertRowDialog } from "@/components/insert-row-dialog";
import { PendingChangesBar } from "@/components/pending-changes-bar";
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
import type { Rel, RowChange, RowKey } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import type { ColumnRow } from "@/lib/queries";
import { usePendingEdits } from "@/lib/use-pending-edits";

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

  const keyOf = useCallback(
    (row: Cell[]): RowKey =>
      Object.fromEntries(primaryKey.map((k) => [k, row[columns.indexOf(k)] ?? null])),
    [primaryKey, columns],
  );
  const columnName = useCallback((c: number) => columns[c] ?? null, [columns]);
  const apply = useCallback((changes: RowChange[]) => updateRowsAction(rel, changes), [rel]);
  const onSaved = useCallback(() => router.refresh(), [router]);
  const edits = usePendingEdits({ rel, rows, columnName, keyOf, apply, onSaved });

  const defs: GridColumn[] = columns.map((name) => ({
    name,
    type: columnMeta.find((m) => m.column_name === name)?.data_type,
    primaryKey: primaryKey.includes(name),
    editable,
  }));

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
              Double-click or press Enter on a cell to edit. Backspace sets NULL. Changes wait until
              you save.
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            No primary key, so rows are read-only here. Use the SQL editor.
          </span>
        )}
      </div>
      <FormError error={error} mono />
      <PendingChangesBar
        count={edits.edits.size}
        sql={edits.sql}
        pending={edits.pending}
        error={edits.error}
        onSave={edits.save}
        onDiscard={edits.discard}
      />
      <Grid
        columns={defs}
        rows={rows}
        {...(editable
          ? { selected, onSelect: setSelected, edits: edits.edits, onEdit: edits.edit }
          : {})}
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
