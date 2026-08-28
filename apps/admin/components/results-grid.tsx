"use client";

import { Download, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { updateRowsAction } from "@/app/actions/data";
import { Grid, type GridColumn } from "@/components/grid";
import { PendingChangesBar } from "@/components/pending-changes-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { csvFileName, saveBlob, toCsv } from "@/lib/csv";
import type { RowChange, RowKey } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import type { PendingEdits } from "@/lib/pending-edits";
import { tablePath } from "@/lib/routes";
import type { ColumnLink, ResultSource } from "@/lib/run-query";
import { recordQuery } from "@/lib/table-filters";
import { usePendingEdits } from "@/lib/use-pending-edits";

interface Props {
  database: string;
  columns: string[];
  rows: Cell[][];
  source: ResultSource | null;
  links: (ColumnLink | null)[];
}

export function ResultsGrid({ database, columns, rows: initial, source, links }: Props) {
  const [rows, setRows] = useState(initial);
  const [search, setSearch] = useState("");
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
    const link = links[i] ?? null;
    return {
      name,
      primaryKey: attname !== null && source?.primaryKey.includes(attname),
      editable: attname !== null,
      linkTo: link ? `${link.schema}.${link.table}` : undefined,
    };
  });
  const linkFor = useCallback(
    (col: number, value: string) => {
      const link = links[col];
      if (!link) return null;
      return `${tablePath(database, link.schema, link.table)}?${recordQuery(link.column, value)}`;
    },
    [links, database],
  );

  function download() {
    const blob = new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
    saveBlob(blob, csvFileName(database, source ? source.table : "query"));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-2 left-2 size-3.5 text-muted-foreground" />
          <Input
            aria-label="filter rows"
            className="h-8 pl-7 font-mono text-xs"
            placeholder="Filter rows"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={download}>
          <Download />
          Download CSV
        </Button>
        <span className="text-xs text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"} loaded
        </span>
      </div>
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
        search={search}
        linkFor={linkFor}
        {...(source ? { edits: edits.edits, onEdit: edits.edit } : {})}
        className="min-h-0 flex-1 rounded-none border-0 bg-transparent"
      />
    </div>
  );
}
