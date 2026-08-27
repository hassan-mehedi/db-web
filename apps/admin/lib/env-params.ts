import { notFound } from "next/navigation";
import { databaseName, isValidProjectEnv } from "./projects";

export interface EnvParams {
  project: string;
  env: string;
}

export function resolveDatabase({ project, env }: EnvParams): string {
  if (!isValidProjectEnv(project, env)) notFound();
  return databaseName(project, env);
}
