"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Rel, RowChange, RowKey } from "./dml";
import type { Cell } from "./format";
import { editKey, groupEdits, type PendingEdits, previewUpdates } from "./pending-edits";

interface Options {
  rel: Rel;
  rows: Cell[][];
  columnName: (col: number) => string | null;
  keyOf: (row: Cell[]) => RowKey;
  apply: (changes: RowChange[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSaved?: (edits: PendingEdits) => void;
}

export function usePendingEdits({ rel, rows, columnName, keyOf, apply, onSaved }: Options) {
  const [edits, setEdits] = useState<PendingEdits>(new Map());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = useCallback(
    (row: number, col: number, value: Cell) => {
      setEdits((prev) => {
        const next = new Map(prev);
        const k = editKey(row, col);
        if (value === (rows[row]?.[col] ?? null)) next.delete(k);
        else next.set(k, value);
        return next;
      });
    },
    [rows],
  );

  const changes = useMemo(
    () => groupEdits(edits, rows, columnName, keyOf),
    [edits, rows, columnName, keyOf],
  );
  const sql = useMemo(() => previewUpdates(rel, changes), [rel, changes]);

  const discard = useCallback(() => {
    setEdits(new Map());
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (changes.length === 0) return true;
    setPending(true);
    setError(null);
    const res = await apply(changes);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    onSaved?.(edits);
    setEdits(new Map());
    return true;
  }, [apply, changes, edits, onSaved]);

  useEffect(() => {
    if (edits.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edits.size, save]);

  return { edits, edit, changes, sql, pending, error, save, discard };
}
