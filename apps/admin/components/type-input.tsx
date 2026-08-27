"use client";

import { useEffect, useId, useState } from "react";
import { checkColumnType } from "@/app/actions/schema";
import { Input } from "@/components/ui/input";
import { COMMON_TYPES } from "@/lib/pg-types";
import { cn } from "@/lib/utils";

type Status = { state: "idle" | "checking" | "ok" } | { state: "bad"; error: string };

export function TypeInput({
  database,
  value,
  onChange,
  id,
  className,
  placeholder,
  suggestions = COMMON_TYPES,
}: {
  database: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  suggestions?: readonly string[];
}) {
  const listId = useId();
  const [status, setStatus] = useState<Status>({ state: "idle" });

  useEffect(() => {
    const type = value.trim();
    if (!type) {
      setStatus({ state: "idle" });
      return;
    }
    setStatus({ state: "checking" });
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await checkColumnType(database, type);
      if (cancelled) return;
      setStatus(res.ok ? { state: "ok" } : { state: "bad", error: res.error });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [database, value]);

  return (
    <div className="grid gap-0.5">
      <Input
        id={id}
        list={listId}
        className={cn(
          "font-mono",
          status.state === "bad" && "border-destructive",
          status.state === "ok" && "border-primary/50",
          className,
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={status.state === "bad" || undefined}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {status.state === "bad" && (
        <span className="truncate text-[11px] text-destructive" title={status.error}>
          {status.error.replace(/^type\s+/, "")}
        </span>
      )}
    </div>
  );
}
