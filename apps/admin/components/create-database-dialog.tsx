"use client";

import {
  bootstrapProjectEnv,
  createDatabasePlan,
  isValidDatabaseName,
  planToSql,
  projectRoles,
} from "@db-web/bootstrap";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createDatabaseAction } from "@/app/actions/cluster";
import { SqlPreview } from "@/components/sql-preview";
import { Button } from "@/components/ui/button";
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

type Step = "form" | "preview" | "done";

export function CreateDatabaseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [bootstrap, setBootstrap] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const valid = isValidDatabaseName(name);
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
    setName("");
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
        <Button size="sm">New database</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create database</DialogTitle>
          <DialogDescription>
            Name as <code>{"{project}_{env}"}</code>, lowercase, e.g. <code>recipes_dev</code>.
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="db-name">Name</Label>
              <Input
                id="db-name"
                value={name}
                onChange={(e) => setName(e.target.value.trim())}
                placeholder="recipes_dev"
                className="font-mono"
                autoFocus
              />
              {name && !valid && (
                <p className="text-xs text-destructive">
                  Must match <code>{"^[a-z][a-z0-9]*_[a-z0-9]+$"}</code>, max 49 chars.
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bootstrap}
                onChange={(e) => setBootstrap(e.target.checked)}
              />
              Also set up PostgREST roles and the <code>api</code> schema
            </label>
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
            {error && <p className="text-sm text-destructive">{error}</p>}
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
