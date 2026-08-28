import type { Cell } from "./format";

const NEEDS_QUOTES = /[",\r\n]/;

export function csvField(value: Cell): string {
  if (value === null) return "";
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function csvLine(cells: Cell[]): string {
  return `${cells.map(csvField).join(",")}\r\n`;
}

export function toCsv(columns: string[], rows: Cell[][]): string {
  return csvLine(columns) + rows.map(csvLine).join("");
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadCsv(
  url: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 500)}` };
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
  saveBlob(await res.blob(), name ?? "export.csv");
  return { ok: true };
}

export function csvFileName(...parts: string[]): string {
  const stem = parts.join("-").replaceAll(/[^A-Za-z0-9_.-]+/g, "_");
  return `${stem}.csv`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const src = text.replace(/^﻿/, "");
  while (i < src.length) {
    const ch = src[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // ignore, \n ends the row
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
