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

export function csvFileName(...parts: string[]): string {
  const stem = parts.join("-").replaceAll(/[^A-Za-z0-9_.-]+/g, "_");
  return `${stem}.csv`;
}
