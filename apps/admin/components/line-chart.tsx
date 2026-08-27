export interface Series {
  label: string;
  color: string;
  values: (number | null)[];
}

export function LineChart({
  title,
  labels,
  series,
  format = (v) => String(Math.round(v)),
  max,
}: {
  title: string;
  labels: string[];
  series: Series[];
  format?: (v: number) => string;
  max?: number;
}) {
  const W = 600;
  const H = 160;
  const PAD = { l: 8, r: 8, t: 8, b: 20 };
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const top = max ?? Math.max(1, ...all) * 1.1;
  const n = labels.length;
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b);
  const last = (s: Series) => [...s.values].reverse().find((v) => v !== null) ?? null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-baseline gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          {series.map((s) => {
            const v = last(s);
            return (
              <span key={s.label} className="flex items-center gap-1">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label} {v === null ? "–" : format(v)}
              </span>
            );
          })}
        </div>
      </div>
      {n < 2 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Not enough samples yet. The sampler runs every minute.
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={title}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(top * f)}
              y2={y(top * f)}
              className="stroke-border"
              strokeDasharray="2 4"
            />
          ))}
          <text x={PAD.l} y={y(top) + 10} className="fill-muted-foreground text-[10px]">
            {format(top)}
          </text>
          {series.map((s) => {
            const d = s.values
              .map((v, i) =>
                v === null
                  ? null
                  : `${i === 0 || s.values[i - 1] === null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
              )
              .filter(Boolean)
              .join(" ");
            return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={1.5} />;
          })}
          <text x={PAD.l} y={H - 6} className="fill-muted-foreground text-[10px]">
            {labels[0]}
          </text>
          <text
            x={W - PAD.r}
            y={H - 6}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {labels[n - 1]}
          </text>
        </svg>
      )}
    </div>
  );
}
