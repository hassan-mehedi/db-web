"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { defaultSuggestions } from "@/lib/pg-types";
import { cn } from "@/lib/utils";

export function DefaultInput({
  type,
  value,
  onChange,
  id,
  className,
  disabled,
}: {
  type: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const suggestions = defaultSuggestions(type);
  return (
    <>
      <Input
        id={id}
        list={listId}
        className={cn("font-mono", className)}
        value={value}
        placeholder={disabled ? "auto" : (suggestions[0] ?? "none")}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
