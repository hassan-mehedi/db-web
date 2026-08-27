import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { Pool } from "pg";

function metaUrl(): string {
  const url = process.env.DATABASE_URL_META;
  if (!url) throw new Error("DATABASE_URL_META is not set");
  return url;
}

export function createAuth(options: { allowSignUp?: boolean } = {}) {
  return betterAuth({
    appName: "db-web",
    database: new Pool({ connectionString: metaUrl(), max: 2 }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUp,
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
      },
    },
    advanced: {
      defaultCookieAttributes: { sameSite: "strict", httpOnly: true },
    },
    plugins: [twoFactor(), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
