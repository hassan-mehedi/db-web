import { cache } from "react";

export interface Timing {
  label: string;
  ms: number;
}

const store = cache(() => ({ started: performance.now(), entries: [] as Timing[] }));

export function startTiming(): void {
  store();
}

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now();
  try {
    return await fn();
  } finally {
    store().entries.push({ label, ms: Math.round(performance.now() - t) });
  }
}

export function timings(): { total: number; entries: Timing[] } {
  const s = store();
  return { total: Math.round(performance.now() - s.started), entries: s.entries };
}

export function logRender(path: string): { total: number; entries: Timing[] } {
  const t = timings();
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      action: "render",
      path,
      total_ms: t.total,
      ...Object.fromEntries(t.entries.map((e) => [`${e.label}_ms`, e.ms])),
    }),
  );
  return t;
}
