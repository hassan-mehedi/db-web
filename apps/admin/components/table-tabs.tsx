"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function TabSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true">
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-8" />
      {Array.from({ length: rows }, (_, i) => `row-${i}`).map((key) => (
        <Skeleton key={key} className="h-9" />
      ))}
    </div>
  );
}

export function TableTabs<T extends string>({
  base,
  tabs,
  active,
  actions,
  children,
}: {
  base: string;
  tabs: readonly T[];
  active: T;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<T | null>(null);
  const shown = pending && target ? target : active;

  return (
    <>
      <div className="mb-4 flex items-center gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`${base}?tab=${t}`}
            aria-current={t === shown ? "page" : undefined}
            className={`px-3 py-2 text-sm ${t === shown ? "-mb-px border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || t === active) return;
              e.preventDefault();
              setTarget(t);
              start(() => router.push(`${base}?tab=${t}`));
            }}
          >
            {t}
          </Link>
        ))}
        <div className="ml-auto pb-2">{actions}</div>
      </div>
      {pending && target ? <TabSkeleton rows={target === "data" ? 10 : 5} /> : children}
    </>
  );
}
