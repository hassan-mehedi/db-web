"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dropTableAction } from "@/app/actions/schema";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tablesPath } from "@/lib/routes";

export function DropTableDialog({
  database,
  schema,
  table,
}: {
  database: string;
  schema: string;
  table: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function drop() {
    setError(null);
    start(async () => {
      const res = await dropTableAction(database, schema, table);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.push(tablesPath(database));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Drop table
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Drop {schema}.{table}
          </DialogTitle>
          <DialogDescription>Deletes the table and every row in it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="drop-table">Type the table name</Label>
            <Input
              id="drop-table"
              className="font-mono"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
          <FormError error={error} />
          <DialogFooter>
            <Button variant="destructive" disabled={typed !== table || pending} onClick={drop}>
              {pending ? "Dropping…" : "Drop"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
