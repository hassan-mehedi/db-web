"use client";

import { type Identity, supportsIdentity } from "@db-web/sql";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABELS: Record<Identity, string> = {
  always: "Always (database assigns the value)",
  default: "By default (you may supply a value)",
};

export function IdentitySelect({
  id,
  type,
  value,
  onChange,
}: {
  id: string;
  type: string;
  value: Identity | null;
  onChange: (value: Identity | null) => void;
}) {
  const allowed = supportsIdentity(type);
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>Auto increment</Label>
      <Select
        value={allowed ? (value ?? "none") : "none"}
        disabled={!allowed}
        onValueChange={(v) => onChange(v === "none" ? null : (v as Identity))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Off</SelectItem>
          {(Object.keys(LABELS) as Identity[]).map((k) => (
            <SelectItem key={k} value={k}>
              {LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!allowed && (
        <span className="text-[11px] text-muted-foreground">
          Only for smallint, integer and bigint columns.
        </span>
      )}
    </div>
  );
}
