import { sampleOnce } from "./metrics";

const INTERVAL_MS = 60_000;
const KEY = Symbol.for("db-web.sampler");

type Holder = { timer?: ReturnType<typeof setInterval> };

export function startSampler(): void {
  const g = globalThis as unknown as Record<symbol, Holder | undefined>;
  if (g[KEY]?.timer) return;
  const holder: Holder = {};
  g[KEY] = holder;
  const tick = () =>
    sampleOnce().catch((err: unknown) => {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          action: "sample-failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    });
  holder.timer = setInterval(tick, INTERVAL_MS);
  holder.timer.unref?.();
  void tick();
}
