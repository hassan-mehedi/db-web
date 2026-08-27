"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sampleNowAction, terminateBackendAction } from "@/app/actions/monitoring";
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
import type { ActivityRow } from "@/lib/metrics";

export function ActivityTable({ database, rows }: { database: string; rows: ActivityRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<number | null>(null);

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
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Live connections ({rows.length})</h2>
        <Button
          size="xs"
          variant="outline"
          className="ml-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await sampleNowAction(database);
              router.refresh();
            })
          }
        >
          Sample now
        </Button>
        <Button size="xs" variant="outline" onClick={() => router.refresh()}>
          Refresh
        </Button>
      </div>
      <FormError error={error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>pid</TableHead>
            <TableHead>user</TableHead>
            <TableHead>app</TableHead>
            <TableHead>state</TableHead>
            <TableHead>since</TableHead>
            <TableHead>query</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.pid}>
              <TableCell className="font-mono text-xs">{r.pid}</TableCell>
              <TableCell className="font-mono text-xs">{r.usename ?? "-"}</TableCell>
              <TableCell className="text-xs">{r.application_name || "-"}</TableCell>
              <TableCell className="text-xs">
                {r.state ?? "-"}
                {r.wait_event_type ? ` (${r.wait_event_type})` : ""}
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {(r.state_change ?? r.backend_start).replace("T", " ").slice(0, 19)}
              </TableCell>
              <TableCell className="max-w-md truncate font-mono text-xs" title={r.query}>
                {r.query}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {confirm === r.pid ? (
                  <span className="flex justify-end gap-1">
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => terminate(r.pid)}
                    >
                      Confirm
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => setConfirm(r.pid)}>
                    Terminate
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No client connections right now.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
