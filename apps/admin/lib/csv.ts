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
