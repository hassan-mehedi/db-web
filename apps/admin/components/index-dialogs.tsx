"use client";

import { createIndex, dropIndex, INDEX_METHODS, type IndexMethod } from "@db-web/sql";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createIndexAction, dropIndexAction } from "@/app/actions/constraints";
import { ConfirmSqlButton } from "@/components/confirm-sql-button";
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
import { Label } from "@/components/ui/label";
import type { Rel } from "@/lib/dml";

export function ColumnPicker({
  columns,
  value,
  onChange,
  label,
}: {
  columns: string[];
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-sm">{label}</span>
      <div className="flex flex-wrap gap-2">
        {columns.map((c) => (
          <label key={c} className="flex items-center gap-1 font-mono text-xs">
            <input
              type="checkbox"
              checked={value.includes(c)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, c] : value.filter((v) => v !== c))
              }
            />
            {c}
          </label>
        ))}
      </div>
    </div>
  );
}

export function CreateIndexDialog({ rel, columns }: { rel: Rel; columns: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cols, setCols] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [unique, setUnique] = useState(false);
  const [method, setMethod] = useState<IndexMethod>("btree");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const input = useMemo(
    () => ({
      schema: rel.schema,
      table: rel.table,
      columns: cols,
      unique,
      method,
      ...(name ? { name } : {}),
    }),
    [rel, cols, unique, method, name],
  );
  const sql = useMemo(() => {
    try {
      return createIndex(input);
    } catch {
      return "";
    }
  }, [input]);

  function close() {
    setOpen(false);
    setCols([]);
    setName("");
    setUnique(false);
    setMethod("btree");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">New index</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create index</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <ColumnPicker
            columns={columns}
            value={cols}
            onChange={setCols}
            label="Columns (in order)"
          />
          <div className="grid gap-1">
            <Label htmlFor="idx-name">Name (optional)</Label>
            <Input
              id="idx-name"
              className="font-mono"
              value={name}
              onChange={(e) => setName(e.target.value.trim())}
            />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={unique}
                onChange={(e) => setUnique(e.target.checked)}
              />
              Unique
            </label>
            <select
              className="rounded border bg-background p-1 font-mono text-xs"
              value={method}
              onChange={(e) => setMethod(e.target.value as IndexMethod)}
            >
              {INDEX_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {sql && <SqlPreview sql={sql} />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              disabled={!sql || pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const res = await createIndexAction(rel.database, input);
                  if (!res.ok) setError(res.error);
                  else {
                    close();
                    router.refresh();
                  }
                });
              }}
            >
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DropIndexButton({ rel, name }: { rel: Rel; name: string }) {
  return (
    <ConfirmSqlButton
      label="Drop"
      destructive
      title={`Drop index ${name}`}
      sql={dropIndex(rel.schema, name)}
      action={() => dropIndexAction(rel.database, rel.schema, rel.table, name)}
    />
  );
}
