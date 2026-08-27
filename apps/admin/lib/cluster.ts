import {
  type BootstrapPlan,
  bootstrapProjectEnv,
  cloneProjectEnv,
  createDatabasePlan,
  isProtectedDatabase,
  isValidDatabaseName,
} from "@db-web/bootstrap";
import { closePool, maintenancePool, withClient } from "@db-web/db";
import {
  type CreateRoleInput,
  createRole,
  dropDatabase as dropDatabaseSql,
  dropRole as dropRoleSql,
  grantRole as grantRoleSql,
  isValidRoleName,
  listRoleMembers,
  listRoles,
  revokeRole as revokeRoleSql,
  terminateBackends,
} from "@db-web/sql";

export interface RoleRow {
  rolname: string;
  rolcanlogin: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolsuper: boolean;
  members: string[];
}

async function runEach(statements: string[]) {
  const pool = maintenancePool();
  for (const s of statements) await pool.query(s);
}

export function planCreateDatabase(input: {
  database: string;
  bootstrap: boolean;
  authenticatorPassword?: string;
}): BootstrapPlan {
  if (!isValidDatabaseName(input.database)) throw new Error("invalid database name");
  if (isProtectedDatabase(input.database)) throw new Error("reserved database name");
  if (!input.bootstrap) return createDatabasePlan(input.database);
  if (!input.authenticatorPassword) throw new Error("authenticator password required");
  return bootstrapProjectEnv({
    database: input.database,
    authenticatorPassword: input.authenticatorPassword,
  });
}

export async function createDatabase(plan: BootstrapPlan, database: string) {
  await runEach(plan.clusterStatements);
  if (plan.databaseStatements.length === 0) return;
  await withClient(database, async (c) => {
    await c.query("BEGIN");
    try {
      for (const s of plan.databaseStatements) await c.query(s);
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
}

export async function sourceHasApiSchema(database: string): Promise<boolean> {
  return withClient(database, async (c) => {
    const { rowCount } = await c.query("SELECT 1 FROM pg_namespace WHERE nspname = 'api'");
    return (rowCount ?? 0) > 0;
  });
}

export async function countBackends(database: string): Promise<number> {
  await closePool(database);
  const { rows } = await maintenancePool().query<{ n: number }>(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [database],
  );
  return rows[0]?.n ?? 0;
}

export async function planCloneDatabase(input: {
  source: string;
  target: string;
  bootstrap: boolean;
  authenticatorPassword?: string;
}): Promise<BootstrapPlan> {
  if (!isValidDatabaseName(input.source)) throw new Error("invalid source database name");
  if (!isValidDatabaseName(input.target)) throw new Error("invalid target database name");
  if (isProtectedDatabase(input.source) || isProtectedDatabase(input.target)) {
    throw new Error("reserved database name");
  }
  if (input.bootstrap && !input.authenticatorPassword) {
    throw new Error("authenticator password required");
  }
  return cloneProjectEnv({
    source: input.source,
    target: input.target,
    sourceHasApiSchema: input.bootstrap ? await sourceHasApiSchema(input.source) : false,
    ...(input.bootstrap && input.authenticatorPassword
      ? { authenticatorPassword: input.authenticatorPassword }
      : {}),
  });
}

export async function cloneDatabase(plan: BootstrapPlan, source: string, force: boolean) {
  await closePool(source);
  const pool = maintenancePool();
  if (force) await pool.query(terminateBackends, [source]);
  await createDatabase(plan, plan.database);
}

export async function dropDatabase(database: string, force: boolean) {
  if (isProtectedDatabase(database)) throw new Error(`${database} cannot be dropped`);
  await closePool(database);
  const pool = maintenancePool();
  if (force) await pool.query(terminateBackends, [database]);
  await pool.query(dropDatabaseSql(database));
}

export async function getRoles(): Promise<RoleRow[]> {
  const pool = maintenancePool();
  const [roles, members] = await Promise.all([
    pool.query<Omit<RoleRow, "members">>(listRoles),
    pool.query<{ role: string; member: string }>(listRoleMembers),
  ]);
  return roles.rows.map((r) => ({
    ...r,
    members: members.rows.filter((m) => m.role === r.rolname).map((m) => m.member),
  }));
}

async function assertNotSuper(...names: string[]) {
  const { rows } = await maintenancePool().query<{ rolname: string }>(
    "SELECT rolname FROM pg_roles WHERE rolsuper AND rolname = ANY($1)",
    [names],
  );
  if (rows.length) throw new Error(`superuser role ${rows[0]?.rolname} is off limits`);
}

export function planCreateRole(input: CreateRoleInput): string {
  return createRole(input);
}

export async function createRoleExec(sql: string) {
  await maintenancePool().query(sql);
}

export async function grantRole(role: string, to: string) {
  if (!isValidRoleName(role) || !isValidRoleName(to)) throw new Error("invalid role name");
  await assertNotSuper(role, to);
  const sql = grantRoleSql(role, to);
  await maintenancePool().query(sql);
  return sql;
}

export async function revokeRole(role: string, from: string) {
  if (!isValidRoleName(role) || !isValidRoleName(from)) throw new Error("invalid role name");
  await assertNotSuper(role, from);
  const sql = revokeRoleSql(role, from);
  await maintenancePool().query(sql);
  return sql;
}

export async function dropRole(name: string) {
  if (!isValidRoleName(name)) throw new Error("invalid role name");
  if (name === "app_admin") throw new Error("app_admin is the role this app runs as");
  await assertNotSuper(name);
  const sql = dropRoleSql(name);
  await maintenancePool().query(sql);
  return sql;
}
