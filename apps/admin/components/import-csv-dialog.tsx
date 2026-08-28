"use client";

import { useMemo, useState, useTransition } from "react";
import { insertRowsAction } from "@/app/actions/data";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseCsv } from "@/lib/csv";
import type { Rel } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import type { ColumnRow } from "@/lib/queries";

const SKIP = "__skip__";
const PREVIEW = 5;

export function ImportCsvDialog({
  rel,
  columns,
  onClose,
  onDone,
}: {
  rel: Rel;
  columns: ColumnRow[];
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [headerRow, setHeaderRow] = useState(true);
  const [emptyIsNull, setEmptyIsNull] = useState(true);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parsed = useMemo(() => parseCsv(text), [text]);
  const header = headerRow ? (parsed[0] ?? []) : [];
  const body = headerRow ? parsed.slice(1) : parsed;
  const width = Math.max(0, ...parsed.map((r) => r.length));
  const names = columns.map((c) => c.column_name);

  const targetFor = (i: number): string => {
    if (mapping[i] !== undefined) return mapping[i];
    const h = header[i]?.trim().toLowerCase();
    return (h && names.find((n) => n.toLowerCase() === h)) ?? names[i] ?? SKIP;
  };
  const targets = Array.from({ length: width }, (_, i) => targetFor(i));
  const used = targets.filter((t) => t !== SKIP);
  const duplicate = used.find((t, i) => used.indexOf(t) !== i);

  function importRows() {
    setError(null);
    const cols = targets.filter((t) => t !== SKIP);
    const rows: Cell[][] = body.map((r) =>
      targets.flatMap((t, i) => {
        if (t === SKIP) return [];
        const v = r[i] ?? "";
        return [emptyIsNull && v === "" ? null : v];
      }),
    );
    start(async () => {
      const res = await insertRowsAction(rel, cols, rows);
      if (!res.ok) setError(res.error);
      else onDone(rows.length);
    });
  }

  async function readFile(file: File) {
    setText(await file.text());
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Import CSV into{" "}
            <span className="font-mono">
              {rel.schema}.{rel.table}
            </span>
          </DialogTitle>
          <DialogDescription>
            Paste rows or pick a file. Each CSV column maps to a table column below. Everything runs
            in one transaction, so a bad row rolls back the whole import.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <textarea
            aria-label="csv text"
            className="min-h-32 w-full rounded-md border bg-background p-2 font-mono text-xs"
            placeholder={"id,name\n1,first\n2,second"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              aria-label="csv file"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
            <Label className="flex items-center gap-1.5 font-normal">
              <Checkbox checked={headerRow} onCheckedChange={(c) => setHeaderRow(c === true)} />
              first row is a header
            </Label>
            <Label className="flex items-center gap-1.5 font-normal">
              <Checkbox checked={emptyIsNull} onCheckedChange={(c) => setEmptyIsNull(c === true)} />
              empty cells become NULL
            </Label>
            <span className="ml-auto text-muted-foreground">
              {body.length} row{body.length === 1 ? "" : "s"}, {width} column
              {width === 1 ? "" : "s"}
            </span>
          </div>
          {width > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    {targets.map((t, i) => (
                      <th
                        // biome-ignore lint/suspicious/noArrayIndexKey: csv columns are positional
                        key={i}
                        className="border-r border-b bg-muted/60 p-1.5 text-left last:border-r-0"
                      >
                        <div className="mb-1 truncate font-mono text-[10px] text-muted-foreground">
                          {headerRow ? header[i] || `column ${i + 1}` : `column ${i + 1}`}
                        </div>
                        <Select
                          value={t}
                          onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v }))}
                        >
                          <SelectTrigger size="sm" className="h-7 w-40 font-mono text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP}>skip</SelectItem>
                            {names.map((n) => (
                              <SelectItem key={n} value={n} className="font-mono text-xs">
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.slice(0, PREVIEW).map((r, ri) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: preview rows are positional
                    <tr key={ri}>
                      {targets.map((t, i) => (
                        <td
                          // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                          key={i}
                          className={`max-w-48 truncate border-r border-b px-1.5 py-1 font-mono last:border-r-0 ${t === SKIP ? "text-muted-foreground/50 line-through" : ""}`}
                        >
                          {r[i] === "" || r[i] === undefined ? (
                            <span className="italic text-muted-foreground/70">
                              {emptyIsNull ? "NULL" : "empty"}
                            </span>
                          ) : (
                            r[i]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {body.length > PREVIEW && (
                <div className="border-t px-2 py-1 text-[11px] text-muted-foreground">
                  and {body.length - PREVIEW} more
                </div>
              )}
            </div>
          )}
          {duplicate && <FormError error={`column ${duplicate} is mapped twice`} />}
          <FormError error={error} mono />
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={importRows}
              disabled={pending || body.length === 0 || used.length === 0 || !!duplicate}
            >
              {pending ? "Importing…" : `Insert ${body.length} row${body.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
