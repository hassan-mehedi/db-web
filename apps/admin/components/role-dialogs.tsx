"use client";

import { createRole, isValidRoleName } from "@db-web/sql";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createRoleAction,
  dropRoleAction,
  grantRoleAction,
  revokeRoleAction,
} from "@/app/actions/cluster";
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

function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onDone: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "failed");
      else {
        onDone();
        router.refresh();
      }
    });
  }
  return { error, pending, run };
}

export function CreateRoleDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [login, setLogin] = useState(false);
  const [createdb, setCreatedb] = useState(false);
  const [createrole, setCreaterole] = useState(false);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const { error, pending, run } = useAction();

  const valid = isValidRoleName(name);
  const sql = useMemo(
    () =>
      valid
        ? createRole({
            name,
            login,
            createdb,
            createrole,
            ...(login && password ? { password } : {}),
          })
        : "",
    [name, login, createdb, createrole, password, valid],
  );

  function close() {
    setOpen(false);
    reset();
  }

  function reset() {
    setName("");
    setLogin(false);
    setCreatedb(false);
    setCreaterole(false);
    setPassword("");
    setDone(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">New role</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="grid gap-3 text-sm">
            <p>
              <code className="font-mono">{name}</code> created.
            </p>
            {login && password && (
              <>
                <p>Password, shown once:</p>
                <SqlPreview sql={password} />
              </>
            )}
            <DialogFooter>
              <Button onClick={close}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value.trim())}
                className="font-mono"
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={login}
                onChange={(e) => {
                  setLogin(e.target.checked);
                  setPassword(e.target.checked ? generatePassword() : "");
                }}
              />
              Can log in (password generated)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createdb}
                onChange={(e) => setCreatedb(e.target.checked)}
              />
              CREATEDB
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createrole}
                onChange={(e) => setCreaterole(e.target.checked)}
              />
              CREATEROLE
            </label>
            {valid && <SqlPreview sql={sql.replace(/PASSWORD '.*'/, "PASSWORD '…'")} />}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                disabled={!valid || pending}
                onClick={() =>
                  run(
                    () =>
                      createRoleAction({
                        name,
                        login,
                        createdb,
                        createrole,
                        ...(login && password ? { password } : {}),
                      }),
                    () => setDone(true),
                  )
                }
              >
                Create
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function GrantRoleDialog({ to, roles }: { to: string; roles: string[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const { error, pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Grant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant a role to {to}</DialogTitle>
          <DialogDescription>
            <code className="font-mono">{to}</code> becomes a member of the chosen role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <select
            className="rounded border bg-background p-2 font-mono text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">choose a role</option>
            {roles
              .filter((r) => r !== to)
              .map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
          </select>
          {role && <SqlPreview sql={`GRANT "${role}" TO "${to}"`} />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              disabled={!role || pending}
              onClick={() =>
                run(
                  () => grantRoleAction(role, to),
                  () => setOpen(false),
                )
              }
            >
              Grant
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeRoleButton({ role, from }: { role: string; from: string }) {
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      className="ml-1 text-muted-foreground hover:text-destructive"
      title={`Revoke ${role} from ${from}`}
      disabled={pending}
      onClick={() =>
        run(
          () => revokeRoleAction(role, from),
          () => undefined,
        )
      }
    >
      ×
    </button>
  );
}

export function DropRoleDialog({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { error, pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Drop
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Drop role {name}</DialogTitle>
          <DialogDescription>Fails if the role still owns objects or has grants.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`drop-role-${name}`}>Type the role name</Label>
            <Input
              id={`drop-role-${name}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={typed !== name || pending}
              onClick={() =>
                run(
                  () => dropRoleAction(name),
                  () => setOpen(false),
                )
              }
            >
              Drop
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
