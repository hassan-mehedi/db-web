"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError } from "@/components/form-error";
import { SqlPreview } from "@/components/sql-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmSqlButton({
  label,
  title,
  sql,
  destructive,
  action,
}: {
  label: string;
  title: string;
  sql: string;
  destructive?: boolean;
  action: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={destructive ? "destructive" : "outline"}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <SqlPreview sql={sql} />
        <FormError error={error} />
        <DialogFooter>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await action();
                if (!res.ok) setError(res.error ?? "failed");
                else {
                  setOpen(false);
                  router.refresh();
                }
              });
            }}
          >
            {pending ? "Running…" : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
