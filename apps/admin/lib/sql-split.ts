export interface Statement {
  text: string;
  from: number;
  to: number;
}

function skipDollarQuote(sql: string, i: number): number {
  const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
  if (!m) return -1;
  const tag = m[0];
  const end = sql.indexOf(tag, i + tag.length);
  return end === -1 ? sql.length : end + tag.length;
}

export function splitStatements(sql: string): Statement[] {
  const out: Statement[] = [];
  let start = 0;
  let i = 0;
  const push = (to: number) => {
    const text = sql.slice(start, to);
    if (text.trim()) {
      const lead = text.length - text.trimStart().length;
      const trail = text.length - text.trimEnd().length;
      out.push({ text: text.trim(), from: start + lead, to: to - trail });
    }
    start = to + 1;
  };
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'" || ch === '"') {
      const end = sql.indexOf(ch, i + 1);
      i = end === -1 ? sql.length : end + 1;
    } else if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else if (ch === "$") {
      const end = skipDollarQuote(sql, i);
      i = end === -1 ? i + 1 : end;
    } else if (ch === ";") {
      push(i);
      i += 1;
    } else {
      i += 1;
    }
  }
  push(sql.length);
  return out;
}

export function statementAt(sql: string, pos: number): Statement | null {
  const all = splitStatements(sql);
  if (all.length === 0) return null;
  for (let n = 0; n < all.length; n++) {
    const s = all[n];
    if (!s) continue;
    if (pos <= s.to) return s;
    const next = all[n + 1];
    const sameLine = !sql.slice(s.to, pos).includes("\n");
    if (sameLine && (!next || pos < next.from)) return s;
  }
  return all[all.length - 1] ?? null;
}
