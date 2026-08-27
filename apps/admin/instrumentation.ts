export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.METRICS_SAMPLER === "off") return;
  if (!process.env.DATABASE_URL_MAINTENANCE || !process.env.DATABASE_URL_META) return;
  const { ensureMetaSchema } = await import("./lib/meta-db");
  await ensureMetaSchema();
  const { startSampler } = await import("./lib/sampler");
  startSampler();
}
