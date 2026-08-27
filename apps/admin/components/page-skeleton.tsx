export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      <header className="flex h-12 items-center border-b px-6">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
      </header>
      <main className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-6 h-6 w-56 animate-pulse rounded bg-muted" />
        <div className="grid gap-3">
          {Array.from({ length: rows }, (_, i) => `row-${i}`).map((key) => (
            <div key={key} className="h-10 animate-pulse rounded-lg border bg-card" />
          ))}
        </div>
      </main>
    </>
  );
}
