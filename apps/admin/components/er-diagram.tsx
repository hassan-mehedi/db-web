import type { DiagramEdge, DiagramTable } from "@/lib/diagram";

const BOX_W = 220;
const ROW_H = 18;
const HEAD_H = 26;
const GAP_X = 80;
const GAP_Y = 40;
const COLS = 3;

export function ErDiagram({
  tables,
  edges,
  database,
}: {
  tables: DiagramTable[];
  edges: DiagramEdge[];
  database: string;
}) {
  if (tables.length === 0) return <p className="text-sm text-muted-foreground">No tables.</p>;

  const heights = tables.map((t) => HEAD_H + t.columns.length * ROW_H + 8);
  const positions = new Map<string, { x: number; y: number; h: number; t: DiagramTable }>();
  const colHeights = Array<number>(COLS).fill(0);
  tables.forEach((t, i) => {
    const col = i % COLS;
    const x = col * (BOX_W + GAP_X);
    const y = colHeights[col] ?? 0;
    const h = heights[i] ?? HEAD_H;
    positions.set(`${t.schema}.${t.name}`, { x, y, h, t });
    colHeights[col] = y + h + GAP_Y;
  });
  const width = COLS * (BOX_W + GAP_X) - GAP_X;
  const height = Math.max(...colHeights);

  function anchor(schema: string, table: string, column: string, side: "left" | "right") {
    const p = positions.get(`${schema}.${table}`);
    if (!p) return null;
    const idx = p.t.columns.findIndex((c) => c.name === column);
    const y = p.y + HEAD_H + (idx < 0 ? 0 : idx * ROW_H + ROW_H / 2) + 4;
    return { x: side === "left" ? p.x : p.x + BOX_W, y };
  }

  return (
    <div className="overflow-auto rounded border">
      <svg
        width={width + 2}
        height={height + 2}
        viewBox={`-1 -1 ${width + 2} ${height + 2}`}
        className="text-foreground"
        role="img"
        aria-label={`Tables and foreign keys in ${database}`}
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
          </marker>
        </defs>
        {edges.map((e) => {
          const fromP = positions.get(`${e.from.schema}.${e.from.table}`);
          const toP = positions.get(`${e.to.schema}.${e.to.table}`);
          if (!fromP || !toP) return null;
          const leftToRight = fromP.x <= toP.x;
          const a = anchor(
            e.from.schema,
            e.from.table,
            e.from.columns[0] ?? "",
            leftToRight ? "right" : "left",
          );
          const b = anchor(
            e.to.schema,
            e.to.table,
            e.to.columns[0] ?? "",
            leftToRight ? "left" : "right",
          );
          if (!a || !b) return null;
          const dx = (b.x - a.x) / 2;
          return (
            <path
              key={e.name}
              d={`M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.5}
              markerEnd="url(#arrow)"
            >
              <title>{e.name}</title>
            </path>
          );
        })}
        {[...positions.values()].map(({ x, y, h, t }) => (
          <g key={`${t.schema}.${t.name}`} transform={`translate(${x},${y})`}>
            <rect width={BOX_W} height={h} rx={6} className="fill-card stroke-border" />
            <rect width={BOX_W} height={HEAD_H} rx={6} className="fill-muted" />
            <a href={`/db/${database}/${t.schema}/${t.name}`}>
              <text x={10} y={17} className="fill-foreground font-mono text-[12px] font-semibold">
                {t.schema !== "public" ? `${t.schema}.` : ""}
                {t.name}
              </text>
            </a>
            {t.columns.map((c, i) => (
              <g key={c.name} transform={`translate(0,${HEAD_H + i * ROW_H})`}>
                <text
                  x={10}
                  y={13}
                  className={`font-mono text-[11px] ${c.pk ? "fill-foreground font-semibold" : "fill-foreground"}`}
                >
                  {c.pk ? "• " : ""}
                  {c.name}
                </text>
                <text
                  x={BOX_W - 10}
                  y={13}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-[10px]"
                >
                  {c.type.length > 16 ? `${c.type.slice(0, 15)}…` : c.type}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
