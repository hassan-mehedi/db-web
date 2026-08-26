"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Cell } from "@/lib/format";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

const helper = createColumnHelper<typeof features, Cell[]>();

export function ResultsGrid({ columns, rows }: { columns: string[]; rows: Cell[][] }) {
  const defs = useMemo(
    () =>
      helper.columns(
        columns.map((name, i) =>
          helper.accessor((row) => row[i] ?? undefined, {
            id: `${i}-${name}`,
            header: name,
            sortFn: "alphanumeric",
            sortUndefined: "last",
          }),
        ),
      ),
    [columns],
  );
  const table = useTable({ features, columns: defs, data: rows });

  return (
    <div className="max-h-[60vh] overflow-auto rounded border">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  className="cursor-pointer select-none whitespace-nowrap font-mono"
                  onClick={h.column.getToggleSortingHandler()}
                >
                  <table.FlexRender header={h} />
                  {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((r) => (
            <TableRow key={r.id}>
              {r.getAllCells().map((c) => {
                const v = (c.getValue() as Cell | undefined) ?? null;
                return (
                  <TableCell
                    key={c.id}
                    className="max-w-xs truncate font-mono text-xs"
                    title={v ?? ""}
                  >
                    {v === null ? <span className="text-muted-foreground">null</span> : v}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
