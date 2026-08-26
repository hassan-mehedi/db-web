export function SqlPreview({ sql }: { sql: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
      {sql}
    </pre>
  );
}
