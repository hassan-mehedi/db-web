"use client";

import {
  type ColumnSpec,
  createTable,
  isSafeExpression,
  isSerialType,
  isValidType,
  supportsIdentity,
} from "@db-web/sql";
import { Link2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createTableAction } from "@/app/actions/schema";
import { DefaultInput } from "@/components/default-input";
import { FormError } from "@/components/form-error";
import { firstReference, ReferencePicker } from "@/components/reference-picker";
import { SqlPreview } from "@/components/sql-preview";
import { TypeInput } from "@/components/type-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompletionSchema } from "@/lib/queries";
import { tablePath } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Row = ColumnSpec & { pk: boolean };
const IDENT = /^[a-z_][a-z0-9_]*$/;
const initialRows: Row[] = [
  { name: "id", type: "bigint", nullable: false, identity: "always", pk: true },
  { name: "created_at", type: "timestamptz", nullable: false, default: "now()", pk: false },
];

export function CreateTableDialog({
  database,
  schemas,
  tables,
}: {
  database: string;
  schemas: string[];
  tables: CompletionSchema;
}) {
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
      columns: rows.map(({ pk: _pk, default: d, references, identity, ...c }) => ({
        ...c,
        ...(identity ? { identity } : {}),
        ...(d ? { default: d } : {}),
        ...(references ? { references } : {}),
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

  const hasTables = Object.values(tables).some((t) => Object.keys(t).length > 0);
  const valid =
    IDENT.test(name) &&
    rows.length > 0 &&
    rows.every(
      (r) =>
        IDENT.test(r.name) &&
        isValidType(r.type) &&
        !isSerialType(r.type) &&
        (!r.default || isSafeExpression(r.default)) &&
        !(r.identity && r.default) &&
        (!r.identity || supportsIdentity(r.type)),
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
        router.push(`${tablePath(database, schema, name)}?tab=columns`);
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
              <Select value={schema} onValueChange={setSchema}>
                <SelectTrigger className="w-40 font-mono" aria-label="schema">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s} value={s} className="font-mono">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="font-mono"
                placeholder="table_name"
                value={name}
                onChange={(e) => setName(e.target.value.trim())}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_1.5fr_1fr_1.75rem_1.75rem_1.75rem_1.75rem_1.75rem] items-center gap-2 text-xs text-muted-foreground">
                <span>Name</span>
                <span>Type</span>
                <span>Default</span>
                <span className="text-center" title="auto increment">
                  Auto
                </span>
                <span className="text-center">Null</span>
                <span className="text-center">PK</span>
                <span className="text-center">FK</span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  key={i}
                  className="grid grid-cols-[1fr_1.5fr_1fr_1.75rem_1.75rem_1.75rem_1.75rem_1.75rem] items-center gap-2"
                >
                  <Input
                    className="font-mono"
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value.trim() })}
                  />
                  <TypeInput
                    database={database}
                    value={r.type}
                    onChange={(type) => {
                      const { identity, ...rest } = r;
                      setRows((prev) =>
                        prev.map((row, j) =>
                          j === i
                            ? {
                                ...rest,
                                type,
                                ...(identity && supportsIdentity(type) ? { identity } : {}),
                              }
                            : row,
                        ),
                      );
                    }}
                  />
                  <DefaultInput
                    type={r.type}
                    value={r.default ?? ""}
                    disabled={!!r.identity}
                    onChange={(d) => update(i, { default: d })}
                  />
                  <div className="flex h-8 w-7 items-center justify-center">
                    <Checkbox
                      aria-label="auto increment"
                      checked={!!r.identity}
                      disabled={!supportsIdentity(r.type)}
                      onCheckedChange={(c) =>
                        setRows((prev) =>
                          prev.map((row, j) => {
                            if (j !== i) return row;
                            const { identity: _identity, default: _default, ...rest } = row;
                            return c === true
                              ? { ...rest, identity: "always", nullable: false }
                              : rest;
                          }),
                        )
                      }
                    />
                  </div>
                  <div className="flex h-8 w-7 items-center justify-center">
                    <Checkbox
                      aria-label="nullable"
                      checked={r.nullable}
                      disabled={!!r.identity}
                      onCheckedChange={(c) => update(i, { nullable: c === true })}
                    />
                  </div>
                  <div className="flex h-8 w-7 items-center justify-center">
                    <Checkbox
                      aria-label="primary key"
                      checked={r.pk}
                      onCheckedChange={(c) => update(i, { pk: c === true })}
                    />
                  </div>
                  <Button
                    size="icon-sm"
                    variant={r.references ? "secondary" : "ghost"}
                    className={cn("size-7", r.references && "text-sky-600 dark:text-sky-400")}
                    aria-label={r.references ? "remove foreign key" : "add foreign key"}
                    aria-pressed={!!r.references}
                    disabled={!hasTables}
                    onClick={() =>
                      setRows((prev) =>
                        prev.map((row, j) => {
                          if (j !== i) return row;
                          const { references, ...rest } = row;
                          return references
                            ? rest
                            : { ...rest, references: firstReference(tables, schema) };
                        }),
                      )
                    }
                  >
                    <Link2 />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-7"
                    aria-label="remove column"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                  {r.references && (
                    <div className="col-span-full rounded-md border border-dashed p-2">
                      <ReferencePicker
                        tables={tables}
                        value={r.references}
                        onChange={(references) => update(i, { references })}
                        idPrefix={`fk-${i}`}
                        className="sm:grid-cols-4"
                      />
                    </div>
                  )}
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
            <FormError error={error} />
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
