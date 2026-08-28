"use client";

import { ArrowDown, ArrowUp, ArrowUpRight, KeyRound, Link2, Lock } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Cell } from "@/lib/format";
import { editKey, type PendingEdits } from "@/lib/pending-edits";
import { cn } from "@/lib/utils";

export interface GridColumn {
  name: string;
  type?: string | undefined;
  primaryKey?: boolean | undefined;
  editable?: boolean | undefined;
  readOnlyHint?: string | undefined;
  linkTo?: string | undefined;
}

export type GridSort = { col: number; desc: boolean } | null;

interface Props {
  columns: GridColumn[];
  rows: Cell[][];
  sortable?: boolean;
  sort?: GridSort;
  onSort?: (next: GridSort) => void;
  linkFor?: (col: number, value: string) => string | null;
  search?: string;
  selected?: Set<number>;
  onSelect?: (next: Set<number>) => void;
  edits?: PendingEdits;
  onEdit?: (row: number, col: number, value: Cell) => void;
  emptyText?: string;
  className?: string;
}

const CELL = "h-8 max-w-xs truncate border-r border-b px-2.5 font-mono text-xs last:border-r-0";

export function Grid({
  columns,
  rows,
  sortable = false,
  sort: controlledSort,
  onSort,
  linkFor,
  search = "",
  selected,
  onSelect,
  edits,
  onEdit,
  emptyText = "No rows",
  className,
}: Props) {
  const [localSort, setLocalSort] = useState<GridSort>(null);
  const sort = onSort ? (controlledSort ?? null) : localSort;
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null);
  const [draft, setDraft] = useState("");
  const tableRef = useRef<HTMLTableElement>(null);

  const valueAt = (row: number, col: number): Cell =>
    edits?.has(editKey(row, col))
      ? (edits.get(editKey(row, col)) ?? null)
      : (rows[row]?.[col] ?? null);

  const order = useMemo(() => {
    const q = search.trim().toLowerCase();
    const idx = rows
      .map((_, i) => i)
      .filter((i) => !q || rows[i]?.some((c) => c?.toLowerCase().includes(q)));
    if (!sort || onSort) return idx;
    const { col, desc } = sort;
    const collator = new Intl.Collator(undefined, { numeric: true });
    idx.sort((a, b) => {
      const x = rows[a]?.[col] ?? null;
      const y = rows[b]?.[col] ?? null;
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return desc ? collator.compare(y, x) : collator.compare(x, y);
    });
    return idx;
  }, [rows, sort, onSort, search]);

  useEffect(() => {
    if (!active) return;
    const el = tableRef.current?.querySelector<HTMLElement>(
      `[data-row="${active.row}"][data-col="${active.col}"]`,
    );
    if (el && document.activeElement?.tagName !== "INPUT") el.focus();
  }, [active]);

  const selectable = !!onSelect && !!selected;
  const allSelected = selectable && rows.length > 0 && selected.size === rows.length;

  function toggleAll(checked: boolean) {
    onSelect?.(checked ? new Set(rows.map((_, i) => i)) : new Set());
  }

  function toggleRow(i: number, checked: boolean) {
    if (!selected) return;
    const next = new Set(selected);
    if (checked) next.add(i);
    else next.delete(i);
    onSelect?.(next);
  }

  function startEdit(row: number, col: number, seed?: string) {
    if (!onEdit || !columns[col]?.editable) return;
    setEditing({ row, col });
    setDraft(seed ?? valueAt(row, col) ?? "");
  }

  function commit(value: Cell) {
    if (!editing || !onEdit) return;
    const target = editing;
    setEditing(null);
    if (value === valueAt(target.row, target.col)) return;
    onEdit(target.row, target.col, value);
  }

  function onCellKey(e: KeyboardEvent<HTMLTableCellElement>, row: number, col: number) {
    if (editing) return;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      const pos = order.indexOf(row);
      const nextRow = order[Math.min(order.length - 1, Math.max(0, pos + dr))] ?? row;
      const nextCol = Math.min(columns.length - 1, Math.max(0, col + dc));
      setActive({ row: nextRow, col: nextCol });
    };
    if (e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) move(0, 1);
    else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) move(0, -1);
    else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit(row, col);
    } else if ((e.key === "Backspace" || e.key === "Delete") && columns[col]?.editable && onEdit) {
      e.preventDefault();
      if (valueAt(row, col) !== null) onEdit(row, col, null);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      startEdit(row, col, e.key);
    }
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const pos = editing;
      commit(draft);
      if (pos) setActive({ row: pos.row, col: Math.min(columns.length - 1, pos.col + 1) });
    }
  }

  function toggleSort(col: number) {
    if (!sortable) return;
    const next: GridSort =
      !sort || sort.col !== col ? { col, desc: false } : sort.desc ? null : { col, desc: true };
    if (onSort) onSort(next);
    else setLocalSort(next);
  }

  return (
    <div className={cn("relative overflow-auto rounded-md border bg-card", className)}>
      <table ref={tableRef} className="w-max min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="w-10 border-r border-b bg-muted/80 px-2 text-center backdrop-blur">
              {selectable ? (
                <Checkbox
                  aria-label="select all rows"
                  checked={allSelected}
                  onCheckedChange={(c) => toggleAll(c === true)}
                />
              ) : (
                <span className="text-[10px] text-muted-foreground">#</span>
              )}
            </th>
            {columns.map((c, i) => {
              const sorted = sort?.col === i ? sort : null;
              return (
                <th
                  // biome-ignore lint/suspicious/noArrayIndexKey: result columns may repeat a name
                  key={`${i}-${c.name}`}
                  className={cn(
                    "border-r border-b bg-muted/80 px-2.5 py-1.5 text-left align-middle backdrop-blur last:border-r-0",
                    sortable && "cursor-pointer select-none hover:bg-muted",
                  )}
                  onClick={() => toggleSort(i)}
                  aria-sort={sorted ? (sorted.desc ? "descending" : "ascending") : undefined}
                >
                  <div className="flex items-center gap-1.5 font-mono text-xs font-medium">
                    {c.primaryKey && <KeyRound className="size-3 text-amber-500" />}
                    {c.linkTo && !c.primaryKey && (
                      <Link2
                        className="size-3 text-sky-500"
                        aria-label={`references ${c.linkTo}`}
                      />
                    )}
                    <span className="truncate">{c.name}</span>
                    {onEdit && !c.editable && c.readOnlyHint && (
                      <Lock className="size-3 text-muted-foreground" aria-label={c.readOnlyHint} />
                    )}
                    {sorted &&
                      (sorted.desc ? (
                        <ArrowDown className="size-3 text-muted-foreground" />
                      ) : (
                        <ArrowUp className="size-3 text-muted-foreground" />
                      ))}
                  </div>
                  {c.type && (
                    <div className="truncate font-mono text-[10px] font-normal text-muted-foreground">
                      {c.type}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {order.map((r, n) => {
            const row = rows[r];
            if (!row) return null;
            const isSelected = selected?.has(r) ?? false;
            return (
              <tr
                key={r}
                data-state={isSelected ? "selected" : undefined}
                className="group hover:bg-muted/40 data-[state=selected]:bg-primary/8"
              >
                <td className="w-10 border-r border-b px-2 text-center font-mono text-[10px] text-muted-foreground">
                  {selectable ? (
                    <Checkbox
                      aria-label="select row"
                      checked={isSelected}
                      onCheckedChange={(c) => toggleRow(r, c === true)}
                    />
                  ) : (
                    n + 1
                  )}
                </td>
                {row.map((_, c) => {
                  const column = columns[c];
                  const changed = edits?.has(editKey(r, c)) ?? false;
                  const cell = valueAt(r, c);
                  const isEditing = editing?.row === r && editing.col === c;
                  const isActive = active?.row === r && active.col === c;
                  const editable = !!onEdit && !!column?.editable;
                  const href = cell !== null && linkFor ? linkFor(c, cell) : null;
                  return (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                      key={`${c}-${column?.name ?? c}`}
                      data-row={r}
                      data-col={c}
                      tabIndex={isEditing ? -1 : 0}
                      title={isEditing ? undefined : (cell ?? "NULL")}
                      className={cn(
                        CELL,
                        "outline-none",
                        isActive && !isEditing && "ring-2 ring-primary ring-inset",
                        isEditing && "p-0",
                        changed && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                        editable && "cursor-cell",
                        !editable && onEdit && "text-muted-foreground",
                      )}
                      onClick={() => setActive({ row: r, col: c })}
                      onDoubleClick={() => startEdit(r, c)}
                      onKeyDown={(e) => onCellKey(e, r, c)}
                    >
                      {isEditing ? (
                        <div className="flex h-8 items-stretch">
                          <input
                            // biome-ignore lint/a11y/noAutofocus: the input replaces the focused cell
                            autoFocus
                            className="h-full min-w-0 flex-1 bg-background px-2.5 font-mono text-xs outline-none ring-2 ring-primary ring-inset"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={onInputKey}
                            onBlur={() => commit(draft)}
                          />
                          <button
                            type="button"
                            className="border-l bg-background px-2 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => commit(null)}
                          >
                            NULL
                          </button>
                        </div>
                      ) : cell === null ? (
                        <span className="italic text-muted-foreground/70">NULL</span>
                      ) : href ? (
                        <span className="flex items-center gap-1">
                          <span className="min-w-0 flex-1 truncate">{cell}</span>
                          <Link
                            href={href}
                            title={`Open ${column?.linkTo ?? "referenced row"}`}
                            aria-label={`open referenced row ${cell}`}
                            className="shrink-0 rounded p-0.5 text-sky-600 opacity-0 hover:bg-sky-500/15 focus-visible:opacity-100 group-hover:opacity-100 dark:text-sky-400"
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {order.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                {rows.length === 0 ? emptyText : "No rows match"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
