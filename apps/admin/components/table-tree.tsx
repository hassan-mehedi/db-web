"use client";

import { ChevronDown, ChevronRight, Search, Table2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { tablePath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface TreeSchema {
  schema: string;
  tables: { relname: string; est_rows: string; size: string }[];
}

export function TableTree({
  database,
  schemas,
  selected,
}: {
  database: string;
  schemas: TreeSchema[];
  selected?: { schema: string; table: string } | undefined;
}) {
  const [filter, setFilter] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const q = filter.trim().toLowerCase();

  return (
    <div className="flex h-full flex-col">
      <label className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tables"
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="flex-1 overflow-y-auto p-2 text-sm">
        {schemas.map(({ schema, tables }) => {
          const visible = q ? tables.filter((t) => t.relname.toLowerCase().includes(q)) : tables;
          if (q && visible.length === 0) return null;
          const isOpen = q ? true : !closed.has(schema);
          return (
            <div key={schema} className="mb-1">
              <button
                type="button"
                onClick={() =>
                  setClosed((prev) => {
                    const next = new Set(prev);
                    if (next.has(schema)) next.delete(schema);
                    else next.add(schema);
                    return next;
                  })
                }
                className="flex w-full items-center gap-1 rounded px-1 py-1 font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                {schema}
                <span className="ml-auto">{tables.length}</span>
              </button>
              {isOpen && (
                <ul className="ml-2 border-l pl-1">
                  {visible.map((t) => {
                    const active = selected?.schema === schema && selected.table === t.relname;
                    return (
                      <li key={t.relname}>
                        <Link
                          href={tablePath(database, schema, t.relname)}
                          className={cn(
                            "flex items-center gap-1.5 rounded px-2 py-1 font-mono text-xs hover:bg-muted",
                            active && "bg-muted text-primary",
                          )}
                        >
                          <Table2 className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{t.relname}</span>
                        </Link>
                      </li>
                    );
                  })}
                  {visible.length === 0 && (
                    <li className="px-2 py-1 text-xs text-muted-foreground">empty</li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
