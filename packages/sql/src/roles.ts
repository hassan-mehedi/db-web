import { quoteIdent, quoteLiteral } from "./quote";

export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export function isValidRoleName(name: string): boolean {
  return ROLE_NAME_PATTERN.test(name) && !name.startsWith("pg_");
}

export interface CreateRoleInput {
  name: string;
  login: boolean;
  createdb: boolean;
  createrole: boolean;
  password?: string;
}

export function createRole(input: CreateRoleInput): string {
  if (!isValidRoleName(input.name)) throw new Error(`invalid role name: ${input.name}`);
  const opts = [
    input.login ? "LOGIN" : "NOLOGIN",
    input.createdb ? "CREATEDB" : "NOCREATEDB",
    input.createrole ? "CREATEROLE" : "NOCREATEROLE",
  ];
  if (input.password) opts.push(`PASSWORD ${quoteLiteral(input.password)}`);
  return `CREATE ROLE ${quoteIdent(input.name)} ${opts.join(" ")}`;
}

export function grantRole(role: string, to: string): string {
  return `GRANT ${quoteIdent(role)} TO ${quoteIdent(to)}`;
}

export function revokeRole(role: string, from: string): string {
  return `REVOKE ${quoteIdent(role)} FROM ${quoteIdent(from)}`;
}

export function dropRole(name: string): string {
  return `DROP ROLE ${quoteIdent(name)}`;
}

export function dropDatabase(name: string): string {
  return `DROP DATABASE ${quoteIdent(name)}`;
}

export const terminateBackends = `
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = $1 AND pid <> pg_backend_pid()`;

export const listRoleMembers = `
SELECT r.rolname AS role, m.rolname AS member
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
WHERE r.rolname NOT LIKE 'pg\\_%'
ORDER BY 1, 2`;

export function alterRolePassword(name: string, password: string): string {
  if (!isValidRoleName(name)) throw new Error(`invalid role name: ${name}`);
  return `ALTER ROLE ${quoteIdent(name)} PASSWORD ${quoteLiteral(password)}`;
}
