export function quoteIdent(name: string): string {
  if (name.length === 0) throw new Error("identifier must not be empty");
  if (name.includes("\0")) throw new Error("identifier must not contain NUL");
  return `"${name.replaceAll('"', '""')}"`;
}

export function quoteQualified(...parts: string[]): string {
  return parts.map(quoteIdent).join(".");
}

export function quoteLiteral(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("literal must be a finite number");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value.includes("\0")) throw new Error("literal must not contain NUL");
  const escaped = value.replaceAll("'", "''");
  return value.includes("\\") ? `E'${escaped.replaceAll("\\", "\\\\")}'` : `'${escaped}'`;
}
