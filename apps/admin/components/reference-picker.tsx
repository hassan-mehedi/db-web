"use client";

import { type ColumnReference, FK_ACTIONS, type FkAction } from "@db-web/sql";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompletionSchema } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface Props {
  tables: CompletionSchema;
  value: ColumnReference;
  onChange: (next: ColumnReference) => void;
  idPrefix: string;
  className?: string;
}

export function firstReference(tables: CompletionSchema, preferSchema: string): ColumnReference {
  const schema = tables[preferSchema] ? preferSchema : (Object.keys(tables)[0] ?? preferSchema);
  const table = Object.keys(tables[schema] ?? {})[0] ?? "";
  const column = tables[schema]?.[table]?.[0] ?? "id";
  return { schema, table, column };
}

export function ReferencePicker({ tables, value, onChange, idPrefix, className }: Props) {
  const options = Object.entries(tables).flatMap(([schema, ts]) =>
    Object.keys(ts).map((table) => `${schema}.${table}`),
  );
  const columns = tables[value.schema]?.[value.table] ?? [];

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-table`} className="text-xs">
          References
        </Label>
        <Select
          value={`${value.schema}.${value.table}`}
          onValueChange={(v) => {
            const [schema = value.schema, table = value.table] = v.split(".", 2);
            const column = tables[schema]?.[table]?.[0] ?? "id";
            onChange({ ...value, schema, table, column });
          }}
        >
          <SelectTrigger id={`${idPrefix}-table`} size="sm" className="w-full font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o} className="font-mono text-xs">
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-column`} className="text-xs">
          Column
        </Label>
        <Select value={value.column} onValueChange={(column) => onChange({ ...value, column })}>
          <SelectTrigger id={`${idPrefix}-column`} size="sm" className="w-full font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(columns.includes(value.column) ? columns : [value.column, ...columns]).map((c) => (
              <SelectItem key={c} value={c} className="font-mono text-xs">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ActionSelect
        id={`${idPrefix}-delete`}
        label="On delete"
        value={value.onDelete}
        onChange={(onDelete) => onChange({ ...value, onDelete })}
      />
      <ActionSelect
        id={`${idPrefix}-update`}
        label="On update"
        value={value.onUpdate}
        onChange={(onUpdate) => onChange({ ...value, onUpdate })}
      />
    </div>
  );
}

function ActionSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: FkAction | undefined;
  onChange: (next: FkAction) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value ?? "NO ACTION"} onValueChange={(v) => onChange(v as FkAction)}>
        <SelectTrigger id={id} size="sm" className="w-full font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FK_ACTIONS.map((a) => (
            <SelectItem key={a} value={a} className="font-mono text-xs">
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
