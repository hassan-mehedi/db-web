"use client";

import { isProdDatabase } from "@db-web/bootstrap";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dropDatabaseAction } from "@/app/actions/cluster";
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

export function DropDatabaseDialog({ database }: { database: string }) {
  const router = useRouter();
  const prod = isProdDatabase(database);
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirmed = first === database && (!prod || second === database);

  function drop() {
    setError(null);
    start(async () => {
      const res = await dropDatabaseAction({ database, force });
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.push("/");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Drop database
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Drop {database}</DialogTitle>
          <DialogDescription>
            This deletes every table and row in <code className="font-mono">{database}</code>.
            {prod && " This is a production database."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="drop-first">Type the database name</Label>
            <Input
              id="drop-first"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </div>
          {prod && (
            <div className="grid gap-2">
              <Label htmlFor="drop-second">Type it again</Label>
              <Input
                id="drop-second"
                value={second}
                onChange={(e) => setSecond(e.target.value)}
                className="font-mono"
                autoComplete="off"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Terminate open connections first
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="destructive" onClick={drop} disabled={!confirmed || pending}>
              {pending ? "Dropping…" : "Drop"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
