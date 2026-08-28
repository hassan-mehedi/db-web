"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { terminateBackendAction } from "@/app/actions/monitoring";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LockWaitRow } from "@/lib/metrics";

export function LockWaits({ database, rows }: { database: string; rows: LockWaitRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [pending, start] = useTransition();

  function terminate(pid: number) {
    setError(null);
    start(async () => {
      const res = await terminateBackendAction(database, pid);
      if (!res.ok) setError(res.error);
      setConfirm(null);
      router.refresh();
    });
  }

  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-medium">Lock waits ({rows.length})</h2>
      <FormError error={error} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No session is waiting on a lock.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>waiting</TableHead>
              <TableHead>for</TableHead>
              <TableHead>on</TableHead>
              <TableHead>blocked by</TableHead>
              <TableHead>blocker query</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.waiting_pid}-${r.blocking_pid}`}>
                <TableCell className="text-xs whitespace-nowrap">
                  <span className="font-mono">{r.waiting_pid}</span> {r.waiting_user ?? ""}
                  <div
                    className="max-w-xs truncate font-mono text-muted-foreground"
                    title={r.waiting_query}
                  >
                    {r.waiting_query}
                  </div>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.waiting_seconds}s</TableCell>
                <TableCell className="text-xs">
                  {r.wait_event_type ?? "-"}
                  {r.wait_event ? ` / ${r.wait_event}` : ""}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  <span className="font-mono">{r.blocking_pid}</span> {r.blocking_user ?? ""}
                  <div className="text-muted-foreground">{r.blocking_state ?? ""}</div>
                </TableCell>
                <TableCell className="max-w-sm truncate font-mono text-xs" title={r.blocking_query}>
                  {r.blocking_query}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {confirm === r.blocking_pid ? (
                    <span className="flex justify-end gap-1">
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => terminate(r.blocking_pid)}
                      >
                        Confirm
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setConfirm(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <Button size="xs" variant="ghost" onClick={() => setConfirm(r.blocking_pid)}>
                      Terminate blocker
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
