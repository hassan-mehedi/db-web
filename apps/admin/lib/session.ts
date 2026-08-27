import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { ensureMetaSchema } from "./meta-db";
import { startTiming, timed } from "./timing";

export async function requireSession() {
  startTiming();
  await ensureMetaSchema();
  const session = await timed("session", async () =>
    getAuth().api.getSession({ headers: await headers() }),
  );
  if (!session) redirect("/login");
  return session;
}
