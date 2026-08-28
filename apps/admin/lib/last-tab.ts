const KEY = "db-web:last-tab";

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function rememberTab(path: string, tab: string) {
  try {
    const all = readAll();
    if (tab === "data") delete all[path];
    else all[path] = tab;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function lastTab(path: string): string | null {
  return readAll()[path] ?? null;
}
