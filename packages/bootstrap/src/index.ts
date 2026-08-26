import { quoteIdent, quoteLiteral } from "@db-web/sql";

export const DATABASE_NAME_PATTERN = /^[a-z][a-z0-9]*_[a-z0-9]+$/;

export function isValidDatabaseName(name: string): boolean {
  return DATABASE_NAME_PATTERN.test(name) && name.length <= 49;
}

export function isProdDatabase(name: string): boolean {
  return name.endsWith("_prod");
}

export interface BootstrapInput {
  database: string;
  authenticatorPassword: string;
}

export interface BootstrapPlan {
  clusterStatements: string[];
  databaseStatements: string[];
}

export interface ProjectRoles {
  anon: string;
  user: string;
  authenticator: string;
}

export function projectRoles(database: string): ProjectRoles {
  return {
    anon: `${database}_anon`,
    user: `${database}_user`,
    authenticator: `${database}_authenticator`,
  };
}

export function createDatabasePlan(database: string): BootstrapPlan {
  if (!isValidDatabaseName(database)) throw new Error(`invalid database name: ${database}`);
  return { clusterStatements: [`CREATE DATABASE ${quoteIdent(database)}`], databaseStatements: [] };
}

export function bootstrapProjectEnv(input: BootstrapInput): BootstrapPlan {
  const base = createDatabasePlan(input.database);
  const r = projectRoles(input.database);
  const anon = quoteIdent(r.anon);
  const user = quoteIdent(r.user);
  const auth = quoteIdent(r.authenticator);
  return {
    clusterStatements: [
      ...base.clusterStatements,
      `CREATE ROLE ${anon} NOLOGIN`,
      `CREATE ROLE ${user} NOLOGIN`,
      `CREATE ROLE ${auth} NOINHERIT LOGIN PASSWORD ${quoteLiteral(input.authenticatorPassword)}`,
      `GRANT ${anon}, ${user} TO ${auth}`,
    ],
    databaseStatements: [
      "CREATE SCHEMA api",
      `GRANT USAGE ON SCHEMA api TO ${anon}, ${user}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO ${anon}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${user}`,
    ],
  };
}

export const PROTECTED_DATABASES = new Set(["postgres", "db_web_meta"]);

export function isProtectedDatabase(name: string): boolean {
  return PROTECTED_DATABASES.has(name) || name.startsWith("template");
}

export function planToSql(plan: BootstrapPlan): string {
  const parts = [...plan.clusterStatements];
  if (plan.databaseStatements.length) {
    parts.push(`\\c ${plan.clusterStatements[0]?.replace(/^CREATE DATABASE /, "") ?? ""}`);
    parts.push(...plan.databaseStatements);
  }
  return `${parts.join(";\n")};`;
}
