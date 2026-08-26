import { createInterface } from "node:readline/promises";
import qrcode from "qrcode-terminal";
import { createAuth } from "../lib/auth";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => rl.question(q);

async function main() {
  const email = process.env.ADMIN_EMAIL ?? (await ask("email: "));
  const password = process.env.ADMIN_PASSWORD ?? (await ask("password (min 8): "));
  const auth = createAuth({ allowSignUp: true });

  const signUp = await auth.api
    .signUpEmail({ body: { email, password, name: "admin" }, returnHeaders: true })
    .catch(() => null);
  const session =
    signUp ?? (await auth.api.signInEmail({ body: { email, password }, returnHeaders: true }));
  if (!signUp) console.log("user exists, signing in");
  const headers = new Headers({ cookie: session.headers.get("set-cookie") ?? "" });

  const enabled = await auth.api.enableTwoFactor({ body: { password }, headers });
  if (enabled.method !== "totp") throw new Error(`unexpected 2fa method ${enabled.method}`);
  console.log("\nScan this in your authenticator app:\n");
  qrcode.generate(enabled.totpURI, { small: true });
  console.log(`\nURI: ${enabled.totpURI}`);
  console.log(`\nBackup codes (store offline):\n${enabled.backupCodes.join("\n")}\n`);

  for (;;) {
    const code = await ask("enter a code from the app to confirm: ");
    try {
      await auth.api.verifyTOTP({ body: { code }, headers });
      break;
    } catch (err) {
      console.log(`rejected: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\nuser ${email} created with TOTP enabled`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
