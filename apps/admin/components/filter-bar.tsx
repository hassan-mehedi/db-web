"use client";

import { FILTER_OP_LABELS, FILTER_OPS, type Filter, type FilterOp, needsValue } from "@db-web/sql";
import { ListFilter, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  columns: string[];
  filters: Filter[];
  onChange: (next: Filter[]) => void;
}

export function FilterBar({ columns, filters, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Filter>({ column: columns[0] ?? "", op: "eq", value: "" });

  const ready = draft.column !== "" && (!needsValue(draft.op) || draft.value !== "");

  function add() {
    if (!ready) return;
    onChange([...filters, { ...draft, value: needsValue(draft.op) ? draft.value : "" }]);
    setDraft({ ...draft, value: "" });
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
        <ListFilter />
        Filter
      </Button>
      {filters.map((f, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: filters are positional
          key={i}
          className="flex h-8 items-center gap-1 rounded-md border bg-muted/40 pl-2 font-mono text-xs"
        >
          <span className="font-medium">{f.column}</span>
          <span className="text-muted-foreground">{FILTER_OP_LABELS[f.op]}</span>
          {needsValue(f.op) && <span className="max-w-48 truncate">{f.value}</span>}
          <button
            type="button"
            aria-label={`remove filter on ${f.column}`}
            className="flex h-full items-center rounded-r-md px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onChange(filters.filter((_, j) => j !== i))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {filters.length > 0 && (
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>
          Clear
        </Button>
      )}
      {adding && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Select value={draft.column} onValueChange={(column) => setDraft({ ...draft, column })}>
            <SelectTrigger className="w-40 font-mono text-xs" aria-label="filter column">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c} value={c} className="font-mono text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={draft.op}
            onValueChange={(op) => setDraft({ ...draft, op: op as FilterOp })}
          >
            <SelectTrigger className="w-32 font-mono text-xs" aria-label="filter operator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPS.map((op) => (
                <SelectItem key={op} value={op} className="font-mono text-xs">
                  {FILTER_OP_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsValue(draft.op) && (
            <Input
              aria-label="filter value"
              className="h-8 w-48 font-mono text-xs"
              placeholder={
                draft.op === "in" ? "a, b, c" : draft.op.endsWith("like") ? "%text%" : "value"
              }
              value={draft.value}
              onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              autoFocus
            />
          )}
          <Button size="sm" type="submit" disabled={!ready}>
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}
