"use client";

import { useCallback, useMemo, useState } from "react";
import { updateRowsAction } from "@/app/actions/data";
import { Grid, type GridColumn } from "@/components/grid";
import { PendingChangesBar } from "@/components/pending-changes-bar";
import type { RowChange, RowKey } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import type { PendingEdits } from "@/lib/pending-edits";
import type { ResultSource } from "@/lib/run-query";
import { usePendingEdits } from "@/lib/use-pending-edits";

interface Props {
  database: string;
  columns: string[];
  rows: Cell[][];
  source: ResultSource | null;
}

export function ResultsGrid({ database, columns, rows: initial, source }: Props) {
  const [rows, setRows] = useState(initial);
  const rel = useMemo(
    () => ({ database, schema: source?.schema ?? "", table: source?.table ?? "" }),
    [database, source],
  );
  const columnName = useCallback((c: number) => source?.columns[c] ?? null, [source]);
  const keyOf = useCallback(
    (row: Cell[]): RowKey =>
      Object.fromEntries(
        (source?.primaryKey ?? []).map((k) => [k, row[source?.columns.indexOf(k) ?? -1] ?? null]),
      ),
    [source],
  );
  const apply = useCallback((changes: RowChange[]) => updateRowsAction(rel, changes), [rel]);
  const onSaved = useCallback((edits: PendingEdits) => {
    setRows((prev) =>
      prev.map((row, r) =>
        row.map((v, c) => (edits.has(`${r}:${c}`) ? (edits.get(`${r}:${c}`) ?? null) : v)),
      ),
    );
  }, []);
  const edits = usePendingEdits({ rel, rows, columnName, keyOf, apply, onSaved });

  const defs: GridColumn[] = columns.map((name, i) => {
    const attname = source?.columns[i] ?? null;
    return {
      name,
      primaryKey: attname !== null && source?.primaryKey.includes(attname),
      editable: attname !== null,
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
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
        sortable
        {...(source ? { edits: edits.edits, onEdit: edits.edit } : {})}
        className="min-h-0 flex-1 rounded-none border-0 bg-transparent"
      />
    </div>
  );
}
