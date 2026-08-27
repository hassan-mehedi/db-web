"use client";

import { Eye, Loader2, Save, Undo2 } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/form-error";
import { SqlPreview } from "@/components/sql-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

interface Props {
  count: number;
  sql: string;
  pending: boolean;
  error: string | null;
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
}

export function PendingChangesBar({ count, sql, pending, error, onSave, onDiscard }: Props) {
  const [review, setReview] = useState(false);
  if (count === 0) return null;
  const label = `${count} change${count === 1 ? "" : "s"}`;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
      <span className="font-medium text-amber-600 dark:text-amber-400">{label} not saved</span>
      <span className="hidden text-muted-foreground sm:inline">
        <Kbd>⌘</Kbd>
        <Kbd>S</Kbd> saves
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onDiscard} disabled={pending}>
          <Undo2 />
          Discard
        </Button>
        <Button size="sm" variant="outline" onClick={() => setReview(true)} disabled={pending}>
          <Eye />
          Review SQL
        </Button>
        <Button size="sm" onClick={() => void onSave()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Save
        </Button>
      </div>
      {error && (
        <div className="basis-full">
          <FormError error={error} mono />
        </div>
      )}
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review {label}</DialogTitle>
            <DialogDescription>
              Runs in one transaction. Each statement must match exactly one row.
            </DialogDescription>
          </DialogHeader>
          <SqlPreview sql={sql} />
          <FormError error={error} mono />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(false)} disabled={pending}>
              Back
            </Button>
            <Button
              onClick={async () => {
                if (await onSave()) setReview(false);
              }}
              disabled={pending}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Run and save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
