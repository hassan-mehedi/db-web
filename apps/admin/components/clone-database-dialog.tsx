"use client";

import { isProdDatabase, projectRoles } from "@db-web/bootstrap";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cloneDatabaseAction, previewCloneAction } from "@/app/actions/cluster";
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
import { databaseName, isValidProjectEnv, parseDatabaseName } from "@/lib/projects";
import { envPath } from "@/lib/routes";

type Step = "form" | "preview" | "done";

export function CloneDatabaseDialog({
  sources,
  defaultSource,
}: {
  sources: string[];
  defaultSource?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [source, setSource] = useState(defaultSource ?? sources[0] ?? "");
  const [env, setEnv] = useState("");
  const [bootstrap, setBootstrap] = useState(true);
  const [password, setPassword] = useState("");
  const [sql, setSql] = useState("");
  const [backends, setBackends] = useState(0);
  const [typed, setTyped] = useState("");
  const [typedTwice, setTypedTwice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const project = parseDatabaseName(source).project;
  const target = databaseName(project, env);
  const valid = Boolean(source) && isValidProjectEnv(project, env) && target !== source;
  const prod = isProdDatabase(source);
  const needsForce = backends > 0;
  const confirmed = !needsForce || (typed === source && (!prod || typedTwice === source));

  function reset() {
    setStep("form");
    setEnv("");
    setBootstrap(true);
    setPassword("");
    setSql("");
    setBackends(0);
    setTyped("");
    setTypedTwice("");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function toPreview() {
    setError(null);
    const pw = bootstrap ? generatePassword() : "";
    setPassword(pw);
    start(async () => {
      const res = await previewCloneAction({
        source,
        target,
        bootstrap,
        ...(bootstrap ? { authenticatorPassword: pw } : {}),
      });
      if (!res.ok) setError(res.error);
      else {
        setSql(res.sql);
        setBackends(res.data?.backends ?? 0);
        setStep("preview");
      }
    });
  }

  function confirm() {
    setError(null);
    start(async () => {
      const res = await cloneDatabaseAction({
        source,
        target,
        bootstrap,
        force: needsForce,
        ...(bootstrap ? { authenticatorPassword: password } : {}),
      });
      if (!res.ok) setError(res.error);
      else {
        setStep("done");
        router.refresh();
      }
    });
  }

  const roles = projectRoles(target);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Clone environment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Clone environment</DialogTitle>
          <DialogDescription>
            Copies schema and data with{" "}
            <code className="font-mono">CREATE DATABASE … TEMPLATE</code>. Postgres needs the source
            idle for that, so open connections get terminated.
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="clone-source">Source</Label>
                <select
                  id="clone-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2 font-mono text-sm"
                >
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clone-env">New environment</Label>
                <Input
                  id="clone-env"
                  value={env}
                  onChange={(e) => setEnv(e.target.value.trim())}
                  placeholder="staging"
                  className="font-mono"
                  autoFocus
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Creates <code className="font-mono">{valid ? target : `${project}_…`}</code>
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bootstrap}
                onChange={(e) => setBootstrap(e.target.checked)}
              />
              Create PostgREST roles for the new database and grant them on{" "}
              <code className="font-mono">api</code>
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button onClick={toPreview} disabled={!valid || pending}>
                {pending ? "Checking…" : "Preview SQL"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="grid gap-4">
            <SqlPreview sql={sql} />
            {needsForce && (
              <div className="grid gap-3 rounded-lg border border-destructive/40 p-3 text-sm">
                <p>
                  <code className="font-mono">{source}</code> has {backends} open connection
                  {backends === 1 ? "" : "s"}. They will be terminated first.
                  {prod && " This is a production database."}
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="clone-typed">Type the source name to allow that</Label>
                  <Input
                    id="clone-typed"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
                {prod && (
                  <div className="grid gap-2">
                    <Label htmlFor="clone-typed-2">Type it again</Label>
                    <Input
                      id="clone-typed-2"
                      value={typedTwice}
                      onChange={(e) => setTypedTwice(e.target.value)}
                      className="font-mono"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")} disabled={pending}>
                Back
              </Button>
              <Button onClick={confirm} disabled={pending || !confirmed}>
                {pending ? "Cloning…" : "Clone"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="grid gap-4 text-sm">
            <p>
              <code className="font-mono">{target}</code> created from{" "}
              <code className="font-mono">{source}</code>.
            </p>
            {bootstrap && (
              <>
                <p>
                  Password for <code className="font-mono">{roles.authenticator}</code>. Shown once;
                  it is not stored anywhere.
                </p>
                <SqlPreview sql={password} />
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Grants to the source's roles were copied along with the data. Revoke them on the roles
              page if the new environment must not share them.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Close
              </Button>
              <Button onClick={() => router.push(envPath(target))}>Open {target}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
