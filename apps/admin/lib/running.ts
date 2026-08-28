interface Running {
  database: string;
  pid: number;
}

const store = globalThis as typeof globalThis & { __dbWebRunning?: Map<string, Running> };
const running = store.__dbWebRunning ?? new Map<string, Running>();
store.__dbWebRunning = running;

export function trackRun(token: string, database: string, pid: number) {
  running.set(token, { database, pid });
}

export function untrackRun(token: string) {
  running.delete(token);
}

export function runningBackend(token: string): Running | null {
  return running.get(token) ?? null;
}
