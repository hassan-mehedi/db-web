"use client";

import { type ColumnSpec, createTable, isSafeExpression, isValidType } from "@db-web/sql";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createTableAction } from "@/app/actions/schema";
import { SqlPreview } from "@/components/sql-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Row = ColumnSpec & { pk: boolean };
const IDENT = /^[a-z_][a-z0-9_]*$/;
const initialRows: Row[] = [
  { name: "id", type: "bigint generated always as identity", nullable: false, pk: true },
  { name: "created_at", type: "timestamptz", nullable: false, default: "now()", pk: false },
];

export function CreateTableDialog({ database, schemas }: { database: string; schemas: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState(schemas[0] ?? "public");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const input = useMemo(
    () => ({
      schema,
      name,
      columns: rows.map(({ pk: _pk, default: d, ...c }) => ({
        ...c,
        ...(d ? { default: d } : {}),
      })),
      primaryKey: rows.filter((r) => r.pk).map((r) => r.name),
    }),
    [schema, name, rows],
  );

  const sql = useMemo(() => {
    try {
      return createTable(input);
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }, [input]);

  const valid =
    IDENT.test(name) &&
    rows.length > 0 &&
    rows.every(
      (r) =>
        IDENT.test(r.name) && isValidType(r.type) && (!r.default || isSafeExpression(r.default)),
    ) &&
    new Set(rows.map((r) => r.name)).size === rows.length;

  function reset() {
    setName("");
    setRows(initialRows);
    setStep("form");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function create() {
    setError(null);
    start(async () => {
      const res = await createTableAction(database, input);
      if (!res.ok) setError(res.error);
      else {
        close();
        router.push(`/db/${database}/${schema}/${name}?tab=columns`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">New table</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create table</DialogTitle>
        </DialogHeader>
        {step === "form" ? (
          <div className="grid gap-4">
            <div className="flex gap-2">
              <select
                className="rounded border bg-background p-2 font-mono text-sm"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
              >
                {schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Input
                className="font-mono"
                placeholder="table_name"
                value={name}
                onChange={(e) => setName(e.target.value.trim())}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_1.5fr_1fr_auto_auto_auto] items-center gap-2 text-xs text-muted-foreground">
                <span>Name</span>
                <span>Type</span>
                <span>Default</span>
                <span>Null</span>
                <span>PK</span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  key={i}
                  className="grid grid-cols-[1fr_1.5fr_1fr_auto_auto_auto] items-center gap-2"
                >
                  <Input
                    className="font-mono"
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value.trim() })}
                  />
                  <Input
                    className="font-mono"
                    value={r.type}
                    onChange={(e) => update(i, { type: e.target.value })}
                  />
                  <Input
                    className="font-mono"
                    value={r.default ?? ""}
                    onChange={(e) => update(i, { default: e.target.value })}
                  />
                  <input
                    type="checkbox"
                    aria-label="nullable"
                    checked={r.nullable}
                    onChange={(e) => update(i, { nullable: e.target.checked })}
                  />
                  <input
                    type="checkbox"
                    aria-label="primary key"
                    checked={r.pk}
                    onChange={(e) => update(i, { pk: e.target.checked })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRows((prev) => [
                      ...prev,
                      { name: "", type: "text", nullable: true, pk: false },
                    ])
                  }
                >
                  Add column
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!valid} onClick={() => setStep("preview")}>
                Preview SQL
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <SqlPreview sql={sql} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")} disabled={pending}>
                Back
              </Button>
              <Button onClick={create} disabled={pending}>
                {pending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
