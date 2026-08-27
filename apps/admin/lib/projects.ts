import { isValidDatabaseName } from "@db-web/bootstrap";

export interface ProjectEnv {
  project: string;
  env: string;
  database: string;
}

export const NO_ENV = "-";

const PROJECT_PATTERN = /^[a-z][a-z0-9]*$/;

export function parseDatabaseName(database: string): ProjectEnv {
  const i = database.lastIndexOf("_");
  if (i <= 0 || i === database.length - 1) {
    return { project: database, env: NO_ENV, database };
  }
  return { project: database.slice(0, i), env: database.slice(i + 1), database };
}

export function databaseName(project: string, env: string): string {
  return env === NO_ENV ? project : `${project}_${env}`;
}

export function envLabel(env: string): string {
  return env === NO_ENV ? "no env" : env;
}

export function isValidProjectEnv(project: string, env: string): boolean {
  if (env === NO_ENV) return PROJECT_PATTERN.test(project);
  return (
    PROJECT_PATTERN.test(project) &&
    /^[a-z0-9]+$/.test(env) &&
    isValidDatabaseName(databaseName(project, env))
  );
}

export interface Project<T> {
  name: string;
  envs: (ProjectEnv & { row: T })[];
}

export function groupByProject<T extends { datname: string }>(rows: T[]): Project<T>[] {
  const map = new Map<string, Project<T>>();
  for (const row of rows) {
    const parsed = parseDatabaseName(row.datname);
    const project = map.get(parsed.project) ?? { name: parsed.project, envs: [] };
    project.envs.push({ ...parsed, row });
    map.set(parsed.project, project);
  }
  return [...map.values()]
    .map((p) => ({ ...p, envs: p.envs.sort((a, b) => envOrder(a.env) - envOrder(b.env)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const ENV_ORDER = ["dev", "test", "staging", "prod"];

function envOrder(env: string): number {
  const i = ENV_ORDER.indexOf(env);
  return i === -1 ? ENV_ORDER.length : i;
}
