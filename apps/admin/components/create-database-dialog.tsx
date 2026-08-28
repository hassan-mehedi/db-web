"use client";

import {
  bootstrapProjectEnv,
  createDatabasePlan,
  planToSql,
  projectRoles,
} from "@db-web/bootstrap";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createDatabaseAction } from "@/app/actions/cluster";
import { FormError } from "@/components/form-error";
import { SqlPreview } from "@/components/sql-preview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generatePassword } from "@/lib/password";
import { databaseName, isValidProjectEnv } from "@/lib/projects";

type Step = "form" | "preview" | "done";

export function CreateDatabaseDialog({
  project: fixedProject,
  label,
}: {
  project?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [project, setProject] = useState(fixedProject ?? "");
  const [env, setEnv] = useState("");
  const name = databaseName(project, env);
  const [bootstrap, setBootstrap] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const valid = isValidProjectEnv(project, env);
  const problem = formProblem(project, env);
  const sql = useMemo(() => {
    if (!valid) return "";
    const plan = bootstrap
      ? bootstrapProjectEnv({ database: name, authenticatorPassword: password })
      : createDatabasePlan(name);
    return planToSql(plan);
  }, [name, bootstrap, password, valid]);

  function close() {
    setOpen(false);
    reset();
  }

  function reset() {
    setStep("form");
    setProject(fixedProject ?? "");
    setEnv("");
    setBootstrap(true);
    setPassword("");
    setError(null);
  }

  function toPreview() {
    if (bootstrap) setPassword(generatePassword());
    setStep("preview");
  }

  function confirm() {
    setError(null);
    start(async () => {
      const res = await createDatabaseAction({
        database: name,
        bootstrap,
        ...(bootstrap ? { authenticatorPassword: password } : {}),
      });
      if (!res.ok) setError(res.error);
      else {
        setStep("done");
        router.refresh();
      }
    });
  }

  const roles = projectRoles(name);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">{label ?? (fixedProject ? "New environment" : "New project")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {fixedProject ? `New environment in ${fixedProject}` : "New project"}
          </DialogTitle>
          <DialogDescription>
            Creates database <code className="font-mono">{valid ? name : "{project}_{env}"}</code>.
            Lowercase letters and digits only.
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="db-project">Project</Label>
                <Input
                  id="db-project"
                  value={project}
                  onChange={(e) => setProject(e.target.value.trim())}
                  placeholder="recipes"
                  className="font-mono"
                  disabled={Boolean(fixedProject)}
                  autoFocus={!fixedProject}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="db-env">Environment</Label>
                <Input
                  id="db-env"
                  value={env}
                  onChange={(e) => setEnv(e.target.value.trim())}
                  placeholder="dev"
                  className="font-mono"
                  autoFocus={Boolean(fixedProject)}
                />
              </div>
            </div>
            {problem && <p className="text-xs text-destructive">{problem}</p>}
            <div className="flex items-center gap-2">
              <Checkbox
                id="db-bootstrap"
                checked={bootstrap}
                onCheckedChange={(c) => setBootstrap(c === true)}
              />
              <Label htmlFor="db-bootstrap">
                Also set up PostgREST roles and the <code>api</code> schema
              </Label>
            </div>
            <DialogFooter>
              <Button onClick={toPreview} disabled={!valid}>
                Preview SQL
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="grid gap-4">
            <SqlPreview sql={sql} />
            <FormError error={error} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")} disabled={pending}>
                Back
              </Button>
              <Button onClick={confirm} disabled={pending}>
                {pending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="grid gap-4 text-sm">
            <p>
              <code className="font-mono">{name}</code> created.
            </p>
            {bootstrap && (
              <>
                <p>
                  Password for <code className="font-mono">{roles.authenticator}</code>. Shown once;
                  it is not stored anywhere.
                </p>
                <SqlPreview sql={password} />
                <p>PostgREST environment for this database:</p>
                <SqlPreview
                  sql={[
                    `PGRST_DB_URI=postgres://${roles.authenticator}:${password}@postgres:5432/${name}`,
                    "PGRST_DB_SCHEMAS=api",
                    `PGRST_DB_ANON_ROLE=${roles.anon}`,
                  ].join("\n")}
                />
                <p>Or a Dokploy compose service, ready to paste (set JWT_SECRET in its env):</p>
                <SqlPreview
                  sql={[
                    "services:",
                    `  postgrest-${name.replaceAll("_", "-")}:`,
                    "    image: postgrest/postgrest:v13.0.0",
                    "    restart: unless-stopped",
                    "    environment:",
                    `      PGRST_DB_URI: postgres://${roles.authenticator}:${password}@postgres:5432/${name}`,
                    "      PGRST_DB_SCHEMAS: api",
                    `      PGRST_DB_ANON_ROLE: ${roles.anon}`,
                    "      PGRST_JWT_SECRET: $" + "{JWT_SECRET}",
                    "      PGRST_DB_POOL: 6",
                    "      PGRST_OPENAPI_MODE: disabled",
                    "    networks:",
                    "      - dokploy-network",
                    "networks:",
                    "  dokploy-network:",
                    "    external: true",
                  ].join("\n")}
                />
              </>
            )}
            <DialogFooter>
              <Button onClick={close}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formProblem(project: string, env: string): string | null {
  if (!project && !env) return null;
  if (project && !/^[a-z][a-z0-9]*$/.test(project)) {
    return "Project: lowercase letters and digits, starting with a letter.";
  }
  if (env && !/^[a-z0-9]+$/.test(env)) return "Environment: lowercase letters and digits.";
  if (!project) return "Project is required.";
  if (!env) return "Environment is required, for example dev.";
  if (!isValidProjectEnv(project, env))
    return "Whole database name must be 49 characters or fewer.";
  return null;
}
