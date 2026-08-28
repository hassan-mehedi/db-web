"use client";

import { dropPolicy, dropTrigger, setRowSecurity } from "@db-web/sql";
import Link from "next/link";
import {
  dropPolicyAction,
  dropTriggerAction,
  setRowSecurityAction,
} from "@/app/actions/constraints";
import { ConfirmSqlButton } from "@/components/confirm-sql-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Rel } from "@/lib/dml";
import type { DependencyRow, PolicyRow, TriggerRow } from "@/lib/queries";
import { queryPath, tablePath } from "@/lib/routes";

export function TriggersTab({ rel, triggers }: { rel: Rel; triggers: TriggerRow[] }) {
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Create triggers in the{" "}
        <Link href={queryPath(rel.database)} className="text-primary">
          SQL editor
        </Link>
        . Drop them here.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Definition</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {triggers.map((t) => (
            <TableRow key={t.name}>
              <TableCell className="font-mono">
                {t.name}
                {!t.enabled && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    disabled
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs whitespace-pre-wrap">
                {t.definition}
              </TableCell>
              <TableCell className="text-right">
                <ConfirmSqlButton
                  label="Drop"
                  destructive
                  title={`Drop trigger ${t.name}`}
                  sql={dropTrigger(rel.schema, rel.table, t.name)}
                  action={() => dropTriggerAction(rel.database, rel.schema, rel.table, t.name)}
                />
              </TableCell>
            </TableRow>
          ))}
          {triggers.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                No triggers.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function PoliciesTab({
  rel,
  policies,
  rowSecurity,
}: {
  rel: Rel;
  policies: PolicyRow[];
  rowSecurity: { enabled: boolean; forced: boolean };
}) {
  const next = !rowSecurity.enabled;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Row level security is{" "}
          <span className={rowSecurity.enabled ? "font-medium text-primary" : "font-medium"}>
            {rowSecurity.enabled ? "enabled" : "disabled"}
          </span>
          {rowSecurity.forced && " and forced for the owner"}.
        </span>
        <ConfirmSqlButton
          label={next ? "Enable RLS" : "Disable RLS"}
          destructive={!next}
          title={`${next ? "Enable" : "Disable"} row level security on ${rel.schema}.${rel.table}`}
          sql={setRowSecurity(rel.schema, rel.table, next)}
          action={() => setRowSecurityAction(rel.database, rel.schema, rel.table, next)}
        />
        {rowSecurity.enabled && policies.length === 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            RLS is on with no policies, so non-owner roles see no rows.
          </span>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Command</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Using</TableHead>
            <TableHead>With check</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.map((p) => (
            <TableRow key={p.name}>
              <TableCell className="font-mono">
                {p.name}
                {!p.permissive && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    restrictive
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-xs">{p.cmd}</TableCell>
              <TableCell className="font-mono text-xs">{p.roles.join(", ")}</TableCell>
              <TableCell className="font-mono text-xs">{p.using ?? "-"}</TableCell>
              <TableCell className="font-mono text-xs">{p.withCheck ?? "-"}</TableCell>
              <TableCell className="text-right">
                <ConfirmSqlButton
                  label="Drop"
                  destructive
                  title={`Drop policy ${p.name}`}
                  sql={dropPolicy(rel.schema, rel.table, p.name)}
                  action={() => dropPolicyAction(rel.database, rel.schema, rel.table, p.name)}
                />
              </TableCell>
            </TableRow>
          ))}
          {policies.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No policies. Create them in the SQL editor with CREATE POLICY.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const KIND_LABEL: Record<DependencyRow["kind"], string> = {
  fk: "foreign key from",
  view: "view",
  matview: "materialized view",
};

export function DependenciesTab({
  rel,
  dependencies,
}: {
  rel: Rel;
  dependencies: DependencyRow[];
}) {
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Objects that depend on {rel.schema}.{rel.table}. Dropping the table fails while any of these
        exist.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kind</TableHead>
            <TableHead>Object</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dependencies.map((d) => (
            <TableRow key={`${d.kind}-${d.schema}.${d.name}-${d.detail ?? ""}`}>
              <TableCell className="text-xs">{KIND_LABEL[d.kind]}</TableCell>
              <TableCell className="font-mono text-xs">
                {d.kind === "fk" ? (
                  <Link href={tablePath(rel.database, d.schema, d.name)} className="text-primary">
                    {d.schema}.{d.name}
                  </Link>
                ) : (
                  `${d.schema}.${d.name}`
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{d.detail ?? "-"}</TableCell>
            </TableRow>
          ))}
          {dependencies.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                Nothing depends on this table.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
