"use client";

import { useState, useTransition } from "react";
import { insertRowAction } from "@/app/actions/data";
import { FormError } from "@/components/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Rel } from "@/lib/dml";
import type { Cell } from "@/lib/format";
import type { ColumnRow } from "@/lib/queries";

type Mode = "default" | "null" | "value";

interface Field {
  mode: Mode;
  text: string;
}

function hasDefault(c: ColumnRow): boolean {
  return c.column_default !== null || c.is_identity === "YES";
}

function defaultLabel(c: ColumnRow): string {
  if (c.is_identity === "YES") return "auto increment";
  return c.column_default ?? "";
}

function initialMode(c: ColumnRow): Mode {
  if (hasDefault(c)) return "default";
  if (c.is_nullable === "YES") return "null";
  return "value";
}

function placeholderFor(c: ColumnRow, mode: Mode) {
  if (mode === "value") return "";
  if (mode === "null") return "NULL";
  return defaultLabel(c);
}

export function InsertRowDialog({
  rel,
  columns,
  primaryKey,
  onClose,
  onDone,
}: {
  rel: Rel;
  columns: ColumnRow[];
  primaryKey: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, Field>>(
    Object.fromEntries(columns.map((c) => [c.column_name, { mode: initialMode(c), text: "" }])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set(c: ColumnRow, field: Field) {
    setValues((v) => ({ ...v, [c.column_name]: field }));
  }

  function submit() {
    const payload: Record<string, Cell> = {};
    for (const [col, v] of Object.entries(values)) {
      if (v.mode === "null") payload[col] = null;
      else if (v.mode === "value") payload[col] = v.text;
    }
    setError(null);
    start(async () => {
      const res = await insertRowAction(rel, payload);
      if (!res.ok) setError(res.error);
      else onDone();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Insert row into{" "}
            <span className="font-mono">
              {rel.schema}.{rel.table}
            </span>
          </DialogTitle>
          <DialogDescription>
            Start typing to set a value. Empty fields use the column default, or NULL when there is
            none.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {columns.map((c) => {
            const v = values[c.column_name] ?? { mode: initialMode(c), text: "" };
            const required = c.is_nullable === "NO" && !hasDefault(c);
            return (
              <div
                key={c.column_name}
                className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_7rem]"
              >
                <Label
                  htmlFor={`ins-${c.column_name}`}
                  className="flex-col items-start gap-0.5 pt-2"
                >
                  <span className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="truncate">{c.column_name}</span>
                    {primaryKey.includes(c.column_name) && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        pk
                      </Badge>
                    )}
                    {required && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        required
                      </Badge>
                    )}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {c.data_type}
                  </span>
                </Label>
                <Input
                  id={`ins-${c.column_name}`}
                  className={`font-mono text-xs ${v.mode !== "value" ? "italic placeholder:text-muted-foreground/60" : ""}`}
                  value={v.mode === "value" ? v.text : ""}
                  placeholder={placeholderFor(c, v.mode)}
                  disabled={c.identity_generation === "ALWAYS"}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (text === "" && !required) set(c, { mode: initialMode(c), text: "" });
                    else set(c, { mode: "value", text });
                  }}
                />
                <Select
                  value={v.mode}
                  onValueChange={(mode) => set(c, { mode: mode as Mode, text: v.text })}
                >
                  <SelectTrigger size="sm" className="w-full font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {c.identity_generation !== "ALWAYS" && (
                      <SelectItem value="value">value</SelectItem>
                    )}
                    {c.is_nullable === "YES" && <SelectItem value="null">NULL</SelectItem>}
                    {hasDefault(c) && <SelectItem value="default">default</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          <FormError error={error} mono />
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Inserting…" : "Insert"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
