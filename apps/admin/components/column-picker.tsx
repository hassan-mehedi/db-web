"use client";

import { Columns3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  columns: string[];
  hidden: Set<number>;
  onChange: (next: Set<number>) => void;
}

export function ColumnPicker({ columns, hidden, onChange }: Props) {
  function toggle(i: number, shown: boolean) {
    const next = new Set(hidden);
    if (shown) next.delete(i);
    else next.add(i);
    onChange(next);
  }
  const label = hidden.size === 0 ? "Columns" : `Columns (${hidden.size} hidden)`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Columns3 />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {columns.map((name, i) => (
          <DropdownMenuCheckboxItem
            // biome-ignore lint/suspicious/noArrayIndexKey: result columns may repeat a name
            key={`${i}-${name}`}
            className="font-mono text-xs"
            checked={!hidden.has(i)}
            onCheckedChange={(c) => toggle(i, c === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {name}
          </DropdownMenuCheckboxItem>
        ))}
        {hidden.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(new Set())}>Show all</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function useHiddenColumns(storageKey: string, columns: string[]) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const names: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(names)) return;
      setHidden(new Set(columns.map((c, i) => (names.includes(c) ? i : -1)).filter((i) => i >= 0)));
    } catch {
      setHidden(new Set());
    }
  }, [storageKey, columns]);
  function update(next: Set<number>) {
    setHidden(next);
    try {
      const names = [...next].map((i) => columns[i]).filter(Boolean);
      if (names.length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(names));
    } catch {}
  }
  return [hidden, update] as const;
}
