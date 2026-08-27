"use client";

import { useState, useTransition } from "react";
import { resetAuthenticatorPasswordAction } from "@/app/actions/roles";
import { CopyButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
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
import { type ConnectInfo, snippets } from "@/lib/connect";
import { cn } from "@/lib/utils";

export function ConnectPanel({ info }: { info: ConnectInfo }) {
  const roles = [info.adminRole, info.authenticatorRole];
  const [role, setRole] = useState(info.authenticatorRole);
  const [password, setPassword] = useState<string | null>(null);
  const list = snippets(info, role).map((s) => ({
    ...s,
    code: password ? s.code.replaceAll("<password>", password) : s.code,
  }));
  const [tab, setTab] = useState(list[0]?.key ?? "url");
  const current = list.find((s) => s.key === tab) ?? list[0];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Role</span>
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              setPassword(null);
            }}
            className={cn(
              "rounded-md border px-2 py-1 font-mono text-xs",
              r === role ? "border-primary/50 bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            {r}
          </button>
        ))}
        {role === info.authenticatorRole && (
          <ResetPasswordDialog database={info.database} onReset={setPassword} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {role === info.adminRole
          ? "The app's own role. Its password lives in the Dokploy env and is not shown here."
          : "Password is not stored. Reset it to get a new one, shown once."}
      </p>
      <div className="flex gap-1 border-b">
        {list.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.key)}
            className={cn(
              "px-3 py-2 text-sm",
              s.key === current?.key
                ? "-mb-px border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {current && (
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border bg-card p-4 font-mono text-xs leading-relaxed">
            {current.code}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={current.code} />
          </div>
        </div>
      )}
    </div>
  );
}

function ResetPasswordDialog({
  database,
  onReset,
}: {
  database: string;
  onReset: (password: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setError(null);
    start(async () => {
      const res = await resetAuthenticatorPasswordAction(database);
      if (!res.ok) setError(res.error);
      else {
        if (res.data) onReset(res.data.password);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xs" variant="outline">
          Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset authenticator password</DialogTitle>
          <DialogDescription>
            Sets a new random password on{" "}
            <code className="font-mono">{database}_authenticator</code>. Any running PostgREST for
            this database stops connecting until you update its env.
          </DialogDescription>
        </DialogHeader>
        <FormError error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={reset} disabled={pending}>
            {pending ? "Resetting…" : "Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
