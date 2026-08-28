import { useEffect, useState } from "react";

export type ColumnWidths = Record<number, number>;

function read(key: string, columns: string[]): ColumnWidths {
  try {
    const raw = localStorage.getItem(key);
    const stored: unknown = raw ? JSON.parse(raw) : {};
    if (!stored || typeof stored !== "object") return {};
    const out: ColumnWidths = {};
    columns.forEach((name, i) => {
      const w = (stored as Record<string, unknown>)[name];
      if (typeof w === "number" && w > 0) out[i] = w;
    });
    return out;
  } catch {
    return {};
  }
}

function write(key: string, columns: string[], widths: ColumnWidths) {
  try {
    const named = Object.fromEntries(
      Object.entries(widths).flatMap(([i, w]) => {
        const name = columns[Number(i)];
        return name ? [[name, w]] : [];
      }),
    );
    if (Object.keys(named).length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(named));
  } catch {}
}

export function useColumnWidths(key: string | undefined, columns: string[]) {
  const [widths, setWidths] = useState<ColumnWidths>({});
  useEffect(() => {
    setWidths(key ? read(key, columns) : {});
  }, [key, columns]);
  function setWidth(col: number, width: number | null) {
    setWidths((prev) => {
      const next = { ...prev };
      if (width === null) delete next[col];
      else next[col] = width;
      if (key) write(key, columns, next);
      return next;
    });
  }
  return [widths, setWidth] as const;
}
