import { projectRoles } from "@db-web/bootstrap";

export interface ConnectInfo {
  host: string;
  port: string;
  database: string;
  adminRole: string;
  authenticatorRole: string;
  anonRole: string;
  tailscaleHost: string | null;
}

export function connectInfo(database: string): ConnectInfo {
  const raw = process.env.DATABASE_URL_MAINTENANCE;
  if (!raw) throw new Error("DATABASE_URL_MAINTENANCE is not set");
  const url = new URL(raw);
  const roles = projectRoles(database);
  return {
    host: url.hostname,
    port: url.port || "5432",
    database,
    adminRole: decodeURIComponent(url.username),
    authenticatorRole: roles.authenticator,
    anonRole: roles.anon,
    tailscaleHost: process.env.TAILSCALE_HOSTNAME ?? null,
  };
}

export function connectionUrl(info: ConnectInfo, role: string, password = "<password>") {
  return `postgres://${role}:${password}@${info.host}:${info.port}/${info.database}`;
}

export function snippets(info: ConnectInfo, role: string) {
  const url = connectionUrl(info, role);
  return [
    { key: "url", label: "URL", code: url },
    {
      key: "psql",
      label: "psql",
      code: `docker run --rm -it --network dokploy-network postgres:17 psql "${url}"`,
    },
    {
      key: "node",
      label: "Node (pg)",
      code: [
        'import { Pool } from "pg";',
        "",
        `const pool = new Pool({ connectionString: "${url}" });`,
        'const { rows } = await pool.query("select now()");',
      ].join("\n"),
    },
    {
      key: "prisma",
      label: "Prisma",
      code: [
        "datasource db {",
        '  provider = "postgresql"',
        '  url      = env("DATABASE_URL")',
        "}",
        "",
        `# .env`,
        `DATABASE_URL="${url}"`,
      ].join("\n"),
    },
    {
      key: "env",
      label: ".env",
      code: [
        `PGHOST=${info.host}`,
        `PGPORT=${info.port}`,
        `PGDATABASE=${info.database}`,
        `PGUSER=${role}`,
        "PGPASSWORD=<password>",
      ].join("\n"),
    },
    {
      key: "postgrest",
      label: "PostgREST",
      code: [
        `PGRST_DB_URI=${connectionUrl(info, info.authenticatorRole)}`,
        "PGRST_DB_SCHEMAS=api",
        `PGRST_DB_ANON_ROLE=${info.anonRole}`,
      ].join("\n"),
    },
  ];
}
