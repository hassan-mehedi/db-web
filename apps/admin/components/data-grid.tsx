"use client";

import type { Filter, Sort } from "@db-web/sql";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { deleteRowsAction, updateRowsAction } from "@/app/actions/data";
import { ColumnPicker, useHiddenColumns } from "@/components/column-picker";
import { FilterBar } from "@/components/filter-bar";
import { FormError } from "@/components/form-error";
import { Grid, type GridColumn, type GridSort } from "@/components/grid";
import { ImportCsvDialog } from "@/components/import-csv-dialog";
import { InsertRowDialog } from "@/components/insert-row-dialog";
import { PendingChangesBar } from "@/components/pending-changes-bar";
import { RowDetail } from "@/components/row-detail";
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
import { downloadCsv } from "@/lib/csv";
import type { Rel, RowChange, RowKey } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import type { ColumnRow, ForeignKeyRow } from "@/lib/queries";
import { tablePath } from "@/lib/routes";
import { recordQuery, serializeFilters, serializeSort } from "@/lib/table-filters";
import { usePendingEdits } from "@/lib/use-pending-edits";

interface Props {
  rel: Rel;
  columns: string[];
  columnMeta: ColumnRow[];
  foreignKeys: ForeignKeyRow[];
  rows: Cell[][];
  primaryKey: string[];
  filters: Filter[];
  sort: Sort | null;
}

export function DataGrid({
  rel,
  columns,
  columnMeta,
  foreignKeys,
  rows,
  primaryKey,
  filters,
  sort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editable = primaryKey.length > 0;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [inserting, setInserting] = useState<false | { initial?: Record<string, Cell> }>(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hidden, setHidden] = useHiddenColumns(
    `db-web:columns:${rel.database}.${rel.schema}.${rel.table}`,
    columns,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [exporting, setExporting] = useState(false);

  const keyOf = useCallback(
    (row: Cell[]): RowKey =>
      Object.fromEntries(primaryKey.map((k) => [k, row[columns.indexOf(k)] ?? null])),
    [primaryKey, columns],
  );
  const columnName = useCallback((c: number) => columns[c] ?? null, [columns]);
  const apply = useCallback((changes: RowChange[]) => updateRowsAction(rel, changes), [rel]);
  const onSaved = useCallback(() => router.refresh(), [router]);
  const edits = usePendingEdits({ rel, rows, columnName, keyOf, apply, onSaved });

  function navigate(next: { filters: Filter[]; sort: Sort | null }) {
    const q = new URLSearchParams(searchParams);
    for (const k of ["page", "after", "before", "f", "s"]) q.delete(k);
    q.set("tab", "data");
    const f = serializeFilters(next.filters);
    const s = serializeSort(next.sort);
    if (f) q.set("f", f);
    if (s) q.set("s", s);
    router.push(`${pathname}?${q}`);
  }

  const gridSort: GridSort = sort ? { col: columns.indexOf(sort.column), desc: sort.desc } : null;
  const onSort = (next: GridSort) =>
    navigate({
      filters,
      sort: next ? { column: columns[next.col] ?? "", desc: next.desc } : null,
    });

  const defs: GridColumn[] = columns.map((name) => {
    const fk = foreignKeys.find((k) => k.column === name);
    const meta = columnMeta.find((m) => m.column_name === name);
    const always = meta?.identity_generation === "ALWAYS";
    return {
      name,
      type: meta?.data_type,
      primaryKey: primaryKey.includes(name),
      editable: editable && !always,
      readOnlyHint: always ? "auto increment, the database assigns this value" : undefined,
      linkTo: fk ? `${fk.refSchema}.${fk.refTable}` : undefined,
    };
  });
  const linkFor = useCallback(
    (col: number, value: string) => {
      const fk = foreignKeys.find((k) => k.column === columns[col]);
      if (!fk) return null;
      return `${tablePath(rel.database, fk.refSchema, fk.refTable)}?${recordQuery(fk.refColumn, value)}`;
    },
    [foreignKeys, columns, rel.database],
  );

  const exportHref = (() => {
    const q = new URLSearchParams({ database: rel.database, schema: rel.schema, table: rel.table });
    const f = serializeFilters(filters);
    const s = serializeSort(sort);
    if (f) q.set("f", f);
    if (s) q.set("s", s);
    return `/api/export?${q}`;
  })();

  async function exportCsv() {
    setError(null);
    setExporting(true);
    const res = await downloadCsv(exportHref);
    setExporting(false);
    if (!res.ok) setError(`Export failed. ${res.error}`);
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
            <Button size="sm" onClick={() => setInserting({})}>
              <Plus />
              Insert row
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
              <Upload />
              Import CSV
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
      <div className="flex flex-wrap items-center gap-2">
        <FilterBar
          columns={columns}
          filters={filters}
          onChange={(next) => navigate({ filters: next, sort })}
        />
        <ColumnPicker columns={columns} hidden={hidden} onChange={setHidden} />
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
          <Download />
          {exporting ? "Preparing CSV" : "Download CSV"}
        </Button>
      </div>
      <FormError error={error} mono />
      {notice && <p className="text-xs text-primary">{notice}</p>}
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
        sort={gridSort}
        onSort={onSort}
        linkFor={linkFor}
        hidden={hidden}
        widthsKey={`db-web:widths:${rel.database}.${rel.schema}.${rel.table}`}
        onOpenRow={setOpenRow}
        {...(editable
          ? { selected, onSelect: setSelected, edits: edits.edits, onEdit: edits.edit }
          : {})}
        className="max-h-[70vh]"
      />

      <RowDetail
        title={`${rel.schema}.${rel.table}`}
        columns={columns}
        types={defs.map((d) => d.type)}
        rows={rows}
        row={openRow}
        onChange={setOpenRow}
        {...(editable
          ? {
              onDuplicate: (values: Record<string, Cell>) => {
                setOpenRow(null);
                setInserting({ initial: values });
              },
            }
          : {})}
      />

      {importing && (
        <ImportCsvDialog
          rel={rel}
          columns={columnMeta}
          onClose={() => setImporting(false)}
          onDone={(count) => {
            setImporting(false);
            setNotice(`Inserted ${count} row${count === 1 ? "" : "s"}.`);
            router.refresh();
          }}
        />
      )}

      {inserting && (
        <InsertRowDialog
          rel={rel}
          columns={columnMeta}
          primaryKey={primaryKey}
          initial={inserting.initial}
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
