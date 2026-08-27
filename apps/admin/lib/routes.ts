import { parseDatabaseName } from "./projects";

export function projectPath(project: string) {
  return `/projects/${project}`;
}

export function envPath(database: string) {
  const { project, env } = parseDatabaseName(database);
  return `/projects/${project}/${env}`;
}

export function tablesPath(database: string) {
  return `${envPath(database)}/tables`;
}

export function tablePath(database: string, schema: string, table: string) {
  return `${tablesPath(database)}/${schema}/${table}`;
}

export function queryPath(database: string) {
  return `${envPath(database)}/query`;
}

export function diagramPath(database: string) {
  return `${envPath(database)}/diagram`;
}

export function rolesPath(database: string) {
  return `${envPath(database)}/roles`;
}

export function connectPath(database: string) {
  return `${envPath(database)}/connect`;
}

export function monitoringPath(database: string) {
  return `${envPath(database)}/monitoring`;
}

export function settingsPath(database: string) {
  return `${envPath(database)}/settings`;
}

const LEGACY_SUFFIX: Record<string, string> = {
  query: "query",
  diagram: "diagram",
};

export function legacyRedirect(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "db" || !parts[1]) return null;
  const database = parts[1];
  const rest = parts.slice(2);
  if (rest.length === 0) return envPath(database);
  const [first, second] = rest;
  if (first && rest.length === 1 && LEGACY_SUFFIX[first]) {
    return `${envPath(database)}/${LEGACY_SUFFIX[first]}`;
  }
  if (first && second && rest.length === 2) return tablePath(database, first, second);
  return envPath(database);
}
