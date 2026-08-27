"use client";

import { useState } from "react";
import { updateRowAction } from "@/app/actions/data";
import { FormError } from "@/components/form-error";
import { Grid, type GridColumn } from "@/components/grid";
import type { Cell } from "@/lib/format";
import type { ResultSource } from "@/lib/run-query";

interface Props {
  database: string;
  columns: string[];
  rows: Cell[][];
  source: ResultSource | null;
}

export function ResultsGrid({ database, columns, rows: initial, source }: Props) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const defs: GridColumn[] = columns.map((name, i) => {
    const attname = source?.columns[i] ?? null;
    return {
      name,
      primaryKey: attname !== null && source?.primaryKey.includes(attname),
      editable: attname !== null,
    };
  });

  const onEdit = source
    ? async (r: number, c: number, value: Cell) => {
        const row = rows[r];
        const attname = source.columns[c];
        if (!row || !attname) return false;
        const key = Object.fromEntries(
          source.primaryKey.map((k) => [k, row[source.columns.indexOf(k)] ?? null]),
        );
        setError(null);
        const res = await updateRowAction(
          { database, schema: source.schema, table: source.table },
          key,
          { [attname]: value },
        );
        if (!res.ok) {
          setError(res.error);
          return false;
        }
        setRows((prev) =>
          prev.map((x, i) => (i === r ? x.map((v, j) => (j === c ? value : v)) : x)),
        );
        return true;
      }
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <FormError error={error} mono />
      <Grid
        columns={defs}
        rows={rows}
        sortable
        {...(onEdit ? { onEdit } : {})}
        className="min-h-0 flex-1 rounded-none border-0 bg-transparent"
      />
    </div>
  );
}
