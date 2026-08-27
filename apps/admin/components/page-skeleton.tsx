import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b px-4">
        <Skeleton className="h-3 w-40" />
      </header>
      <div className="mx-auto w-full max-w-6xl p-6">
        <Skeleton className="mb-6 h-6 w-56" />
        <div className="grid gap-3">
          {Array.from({ length: rows }, (_, i) => `row-${i}`).map((key) => (
            <Skeleton key={key} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}
