"use client";

import {
  addCheck,
  addForeignKey,
  addUnique,
  dropConstraint,
  type FkAction,
  isSafeExpression,
} from "@db-web/sql";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addCheckAction,
  addForeignKeyAction,
  addUniqueAction,
  dropConstraintAction,
} from "@/app/actions/constraints";
import { ConfirmSqlButton } from "@/components/confirm-sql-button";
import { FormError } from "@/components/form-error";
import { ColumnPicker } from "@/components/index-dialogs";
import { ActionSelect } from "@/components/reference-picker";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Rel } from "@/lib/dml";

type Kind = "foreign key" | "unique" | "check";

export function AddConstraintDialog({
  rel,
  columns,
  tables,
}: {
  rel: Rel;
  columns: string[];
  tables: { schema: string; table: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("foreign key");
  const [cols, setCols] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [refTable, setRefTable] = useState("");
  const [refColumns, setRefColumns] = useState("id");
  const [onDelete, setOnDelete] = useState<FkAction>("NO ACTION");
  const [onUpdate, setOnUpdate] = useState<FkAction>("NO ACTION");
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [refSchema, refTableName] = refTable.includes(".")
    ? refTable.split(".", 2)
    : [rel.schema, refTable];

  const built = useMemo(() => {
    try {
      if (kind === "foreign key") {
        const input = {
          schema: rel.schema,
          table: rel.table,
          columns: cols,
          refSchema: refSchema ?? rel.schema,
          refTable: refTableName ?? "",
          refColumns: refColumns
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          onDelete,
          onUpdate,
          ...(name ? { name } : {}),
        };
        if (!input.refTable) return null;
        return { sql: addForeignKey(input), run: () => addForeignKeyAction(rel.database, input) };
      }
      if (kind === "unique") {
        const input = {
          schema: rel.schema,
          table: rel.table,
          columns: cols,
          ...(name ? { name } : {}),
        };
        return { sql: addUnique(input), run: () => addUniqueAction(rel.database, input) };
      }
      if (!name || !isSafeExpression(expression)) return null;
      const input = { schema: rel.schema, table: rel.table, name, expression };
      return { sql: addCheck(input), run: () => addCheckAction(rel.database, input) };
    } catch {
      return null;
    }
  }, [kind, rel, cols, name, refSchema, refTableName, refColumns, onDelete, onUpdate, expression]);

  function close() {
    setOpen(false);
    setCols([]);
    setName("");
    setRefTable("");
    setRefColumns("id");
    setExpression("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">New constraint</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add constraint</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <RadioGroup
            value={kind}
            onValueChange={(k) => setKind(k as Kind)}
            className="flex gap-4"
            aria-label="constraint kind"
          >
            {(["foreign key", "unique", "check"] as Kind[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <RadioGroupItem id={`kind-${k.replace(" ", "-")}`} value={k} />
                <Label htmlFor={`kind-${k.replace(" ", "-")}`}>{k}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="grid gap-1">
            <Label htmlFor="con-name">Name {kind === "check" ? "" : "(optional)"}</Label>
            <Input
              id="con-name"
              className="font-mono"
              value={name}
              onChange={(e) => setName(e.target.value.trim())}
            />
          </div>
          {kind !== "check" && (
            <ColumnPicker columns={columns} value={cols} onChange={setCols} label="Columns" />
          )}
          {kind === "foreign key" && (
            <>
              <div className="grid gap-1">
                <Label htmlFor="ref-table">References table</Label>
                <Input
                  id="ref-table"
                  className="font-mono"
                  list="fk-tables"
                  placeholder="schema.table or table"
                  value={refTable}
                  onChange={(e) => setRefTable(e.target.value.trim())}
                />
                <datalist id="fk-tables">
                  {tables.map((t) => (
                    <option key={`${t.schema}.${t.table}`} value={`${t.schema}.${t.table}`} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="ref-cols">Referenced columns (comma separated)</Label>
                <Input
                  id="ref-cols"
                  className="font-mono"
                  value={refColumns}
                  onChange={(e) => setRefColumns(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ActionSelect
                  id="fk-on-delete"
                  label="On delete"
                  value={onDelete}
                  onChange={setOnDelete}
                />
                <ActionSelect
                  id="fk-on-update"
                  label="On update"
                  value={onUpdate}
                  onChange={setOnUpdate}
                />
              </div>
            </>
          )}
          {kind === "check" && (
            <div className="grid gap-1">
              <Label htmlFor="check-expr">Expression</Label>
              <Input
                id="check-expr"
                className="font-mono"
                placeholder="price > 0"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
              />
            </div>
          )}
          {built && <SqlPreview sql={built.sql} />}
          <FormError error={error} />
          <DialogFooter>
            <Button
              disabled={!built || pending}
              onClick={() => {
                if (!built) return;
                setError(null);
                start(async () => {
                  const res = await built.run();
                  if (!res.ok) setError(res.error);
                  else {
                    close();
                    router.refresh();
                  }
                });
              }}
            >
              {pending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DropConstraintButton({ rel, name }: { rel: Rel; name: string }) {
  return (
    <ConfirmSqlButton
      label="Drop"
      destructive
      title={`Drop constraint ${name}`}
      sql={dropConstraint(rel.schema, rel.table, name)}
      action={() => dropConstraintAction(rel.database, rel.schema, rel.table, name)}
    />
  );
}
