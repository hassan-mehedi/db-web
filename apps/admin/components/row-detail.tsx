"use client";

import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Cell } from "@/lib/format";
import { prettyCell, rowObject } from "@/lib/row-json";

interface Props {
  title: string;
  columns: string[];
  types?: (string | undefined)[];
  rows: Cell[][];
  row: number | null;
  onChange: (row: number | null) => void;
  onDuplicate?: (values: Record<string, Cell>) => void;
}

export function RowDetail({ title, columns, types, rows, row, onChange, onDuplicate }: Props) {
  const cells = row === null ? null : (rows[row] ?? null);
  const json = cells ? JSON.stringify(rowObject(columns, cells), null, 2) : "";
  return (
    <Sheet open={cells !== null} onOpenChange={(o) => !o && onChange(null)}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono text-sm">{title}</SheetTitle>
          <SheetDescription>
            Row {(row ?? 0) + 1} of {rows.length}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {cells && (
            <dl className="divide-y">
              {columns.map((name, i) => {
                const value = cells[i] ?? null;
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: result columns may repeat a name
                    key={`${i}-${name}`}
                    className="group grid gap-1 px-4 py-2.5"
                  >
                    <dt className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-medium">{name}</span>
                      {types?.[i] && (
                        <span className="text-[10px] text-muted-foreground">{types[i]}</span>
                      )}
                      {value !== null && (
                        <button
                          type="button"
                          aria-label={`copy ${name}`}
                          className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                          onClick={() => navigator.clipboard.writeText(value)}
                        >
                          <Copy className="size-3" />
                        </button>
                      )}
                    </dt>
                    <dd className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 px-2 py-1.5 font-mono text-xs">
                      {value === null ? (
                        <span className="italic text-muted-foreground/70">NULL</span>
                      ) : value === "" ? (
                        <span className="italic text-muted-foreground/70">empty string</span>
                      ) : (
                        prettyCell(value)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
        <SheetFooter className="flex-row items-center gap-2 border-t">
          <Button
            size="xs"
            variant="outline"
            aria-label="previous row"
            disabled={row === null || row === 0}
            onClick={() => row !== null && onChange(row - 1)}
          >
            <ChevronUp />
          </Button>
          <Button
            size="xs"
            variant="outline"
            aria-label="next row"
            disabled={row === null || row >= rows.length - 1}
            onClick={() => row !== null && onChange(row + 1)}
          >
            <ChevronDown />
          </Button>
          <span className="flex-1" />
          <CopyButton text={json} label="Copy JSON" />
          {onDuplicate && cells && (
            <Button size="xs" onClick={() => onDuplicate(rowObject(columns, cells))}>
              Duplicate
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
