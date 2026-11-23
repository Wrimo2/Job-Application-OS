import * as React from 'react';
import { useMemo, useState } from 'react';
import { addDays, format, startOfWeek, subWeeks } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Layer,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Table2 } from 'lucide-react';
import type { DayActivity, FunnelStep } from '@/lib/stats';
import { cn, dayKey, fmtPct } from '@/lib/utils';
import { Card, CardHeader } from './ui';
import { Tip } from './overlay';

/* ───────────────────────── Shell ───────────────────────── */

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  action,
  table,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  /** Accessible table twin of the chart */
  table?: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <>
            {action}
            {table && (
              <Tip content={showTable ? 'Show chart' : 'Show as table'}>
                <button
                  onClick={() => setShowTable(!showTable)}
                  className={cn('grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground', showTable && 'bg-accent text-foreground')}
                  aria-label="Toggle table view"
                >
                  <Table2 className="h-3.5 w-3.5" />
                </button>
              </Tip>
            )}
          </>
        }
      />
      <div className="min-w-0 flex-1 px-4 pb-4 pt-3 sm:px-5">{showTable && table ? table : children}</div>
    </Card>
  );
}

export function MiniTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={cn('py-1.5 pr-3 font-medium', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((c, j) => (
                <td key={j} className={cn('py-1.5 pr-3', j > 0 && 'text-right tabular-nums')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Tooltip ───────────────────────── */

function TooltipBox({ active, payload, label, formatter }: { active?: boolean; payload?: any[]; label?: string; formatter?: (v: number, name: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-[12px] shadow-lift">
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.fill || p.stroke }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{formatter ? formatter(p.value, p.name) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tick: { fill: 'var(--chart-axis)', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'var(--chart-grid)' },
} as const;

/* ───────────────────────── Funnel ───────────────────────── */

export function Funnel({ steps, onSelect }: { steps: FunnelStep[]; onSelect?: (id: string) => void }) {
  const max = Math.max(1, steps[0]?.count ?? 1);
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const w = Math.max(2, (s.count / max) * 100);
        const inside = w > 22;
        return (
          <div key={s.id}>
            {i > 0 && (
              <div className="mb-1 flex items-center gap-1.5 pl-1 text-[11px] text-muted-foreground">
                <span className="inline-block h-2.5 w-px bg-border" />
                {fmtPct(s.fromPrev)} converted
              </div>
            )}
            <button onClick={() => onSelect?.(s.id)} className="group flex w-full items-center gap-3 text-left" title={`${s.label}: ${s.count} (${fmtPct(s.ofTop)} of applied)`}>
              <span className="w-28 shrink-0 truncate text-[12.5px] font-medium text-foreground/85">{s.label}</span>
              <div className="relative h-7 min-w-0 flex-1">
                <div
                  className="flex h-full items-center justify-end rounded-r-[4px] px-2 transition-[width] duration-700 group-hover:opacity-90"
                  style={{ width: `${w}%`, background: `var(--ord-${Math.min(5, i + 1)})` }}
                >
                  {inside && (
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: `var(--ord-ink-${Math.min(5, i + 1)})` }}>
                      {s.count}
                    </span>
                  )}
                </div>
                {!inside && (
                  <span className="absolute top-1/2 -translate-y-1/2 pl-2 text-[12px] font-semibold tabular-nums" style={{ left: `${w}%` }}>
                    {s.count}
                  </span>
                )}
              </div>
              <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">{fmtPct(s.ofTop)}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Ranked bars ───────────────────────── */

export interface BarListRow {
  key: string;
  label: React.ReactNode;
  value: number;
  display?: string;
  sub?: string;
  dot?: string;
}

export function BarList({ rows, max, onSelect, emptyText = 'Not enough data yet' }: { rows: BarListRow[]; max?: number; onSelect?: (key: string) => void; emptyText?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const w = Math.max(r.value > 0 ? 2 : 0, (r.value / m) * 100);
        return (
          <button key={r.key} onClick={() => onSelect?.(r.key)} className={cn('group block w-full text-left', !onSelect && 'cursor-default')}>
            <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px]">
              <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-foreground/85">
                {r.dot && <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: r.dot }} />}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{r.display ?? r.value}</span>
                {r.sub && <span className="ml-1.5 text-muted-foreground">{r.sub}</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-[width] duration-700 group-hover:opacity-80" style={{ width: `${w}%`, background: 'var(--s1)' }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Tall segmented bar ───────────────────────── */

export function SegmentedBar({ parts, onSelect }: { parts: { key: string; label: string; value: number; className: string }[]; onSelect?: (key: string) => void }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <p className="py-6 text-center text-[13px] text-muted-foreground">Nothing to show yet</p>;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden">
        {shown.map((p, i) => {
          const pct = (p.value / total) * 100;
          return (
            <Tip key={p.key} content={`${p.label}: ${p.value} (${pct.toFixed(0)}%)`}>
              <button
                onClick={() => onSelect?.(p.key)}
                className={cn('flex h-full items-center px-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-85', p.className, i === 0 && 'rounded-l-[4px]', i === shown.length - 1 && 'rounded-r-[4px]')}
                style={{ width: `${pct}%` }}
                aria-label={`${p.label} ${p.value}`}
              >
                {pct >= 7 ? p.value : ''}
              </button>
            </Tip>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {shown.map((p) => (
          <button key={p.key} onClick={() => onSelect?.(p.key)} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
            <span className={cn('h-2 w-2 rounded-[3px]', p.className)} />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Heatmap ───────────────────────── */

export function ActivityHeatmap({ activity, weeks = 20, weekStartsOn = 1 }: { activity: Map<string, DayActivity>; weeks?: number; weekStartsOn?: 0 | 1 }) {
  const [hover, setHover] = useState<{ x: number; y: number; key: string; a?: DayActivity } | null>(null);
  const { grid, months, max } = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(subWeeks(today, weeks - 1), { weekStartsOn });
    const g: { key: string; date: Date; a?: DayActivity; future: boolean }[][] = [];
    const ms: { col: number; label: string }[] = [];
    let mx = 1;
    for (let w = 0; w < weeks; w++) {
      const col: (typeof g)[number] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        const key = dayKey(date);
        const a = activity.get(key);
        if (a) mx = Math.max(mx, a.total);
        col.push({ key, date, a, future: date > today });
        if (d === 0 && (w === 0 || date.getDate() <= 7)) ms.push({ col: w, label: format(date, 'MMM') });
      }
      g.push(col);
    }
    return { grid: g, months: ms, max: mx };
  }, [activity, weeks, weekStartsOn]);

  const level = (n: number) => (n <= 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  const cell = 13;
  const gap = 3;
  const dayLabels = weekStartsOn === 1 ? ['Mon', '', 'Wed', '', 'Fri', '', ''] : ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-2">
          <div className="flex flex-col pt-[18px]" style={{ gap }}>
            {dayLabels.map((l, i) => (
              <span key={i} className="text-[10px] leading-none text-muted-foreground" style={{ height: cell, lineHeight: `${cell}px` }}>
                {l}
              </span>
            ))}
          </div>
          <div>
            <div className="relative mb-1 h-[14px]">
              {months.map((m) => (
                <span key={`${m.col}-${m.label}`} className="absolute text-[10px] text-muted-foreground" style={{ left: m.col * (cell + gap) }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap }}>
              {grid.map((col, ci) => (
                <div key={ci} className="flex flex-col" style={{ gap }}>
                  {col.map((c) => (
                    <div
                      key={c.key}
                      onMouseEnter={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const parent = (e.currentTarget as HTMLElement).closest('.relative')!.getBoundingClientRect();
                        setHover({ x: r.left - parent.left + cell / 2, y: r.top - parent.top, key: c.key, a: c.a });
                      }}
                      onMouseLeave={() => setHover(null)}
                      className={cn('rounded-[3px] transition-transform hover:scale-125', c.future && 'opacity-0')}
                      style={{ width: cell, height: cell, background: `var(--seq-${level(c.a?.total ?? 0)})` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10.5px] text-muted-foreground">
        Less
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className="rounded-[3px]" style={{ width: 11, height: 11, background: `var(--seq-${l})` }} />
        ))}
        More
      </div>
      {hover && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-[11.5px] shadow-lift" style={{ left: hover.x, top: hover.y - 6 }}>
          <div className="font-medium">{format(new Date(`${hover.key}T12:00:00`), 'EEE, d MMM')}</div>
          {hover.a ? (
            <div className="text-muted-foreground">
              {hover.a.applications} applied · {hover.a.outreach} outreach
              {hover.a.interviews ? ` · ${hover.a.interviews} interviews` : ''}
              {hover.a.tasks ? ` · ${hover.a.tasks} tasks` : ''}
            </div>
          ) : (
            <div className="text-muted-foreground">No activity</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Recharts wrappers ───────────────────────── */

export function GroupedBars({
  data,
  series,
  height = 240,
  xKey = 'label',
}: {
  data: object[];
  series: { key: string; name: string; color: string }[];
  height?: number;
  xKey?: string;
}) {
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }} content={<TooltipBox />} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

export function Lines({ data, series, height = 220, xKey = 'label' }: { data: object[]; series: { key: string; name: string; color: string }[]; height?: number; xKey?: string }) {
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} content={<TooltipBox />} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--chart-surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

export function Legend({ series }: { series: { key: string; name: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export function ColumnChart({ data, height = 200, color = 'var(--s1)', name = 'Count' }: { data: { label: string; value: number }[]; height?: number; color?: string; name?: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }} content={<TooltipBox />} />
          <Bar dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} label={{ position: 'top', fill: 'var(--chart-ink)', fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────── Sankey ───────────────────────── */

interface SNode {
  name: string;
  color: string;
}

export function FlowSankey({ nodes, links, height = 300 }: { nodes: SNode[]; links: { source: number; target: number; value: number }[]; height?: number }) {
  // Drop empty links & unreferenced nodes, then re-index (Recharts requires every node to be connected).
  const clean = useMemo(() => {
    const live = links.filter((l) => l.value > 0);
    const used = Array.from(new Set(live.flatMap((l) => [l.source, l.target]))).sort((a, b) => a - b);
    const remap = new Map(used.map((old, i) => [old, i]));
    return {
      nodes: used.map((i) => nodes[i]),
      links: live.map((l) => ({ source: remap.get(l.source)!, target: remap.get(l.target)!, value: l.value })),
    };
  }, [nodes, links]);
  if (!clean.links.length) return <p className="py-10 text-center text-[13px] text-muted-foreground">Apply to a few jobs to see how they flow through your pipeline.</p>;

  const NodeShape = (props: any) => {
    const { x, y, width, height: h, payload } = props;
    // Terminal (right-most) nodes have no outgoing links: put their labels on the left so they never clip.
    // (Recharts names outgoing links `targetLinks` — the reverse of d3-sankey.)
    const right = !payload.targetLinks?.length;
    return (
      <Layer>
        <Rectangle x={x} y={y} width={width} height={h} fill={payload.color} radius={2} />
        <text
          x={right ? x - 6 : x + width + 6}
          y={y + h / 2}
          textAnchor={right ? 'end' : 'start'}
          dominantBaseline="middle"
          fontSize={11.5}
          fill="var(--chart-ink)"
        >
          {payload.name} <tspan fontWeight={600}>{payload.value}</tspan>
        </text>
      </Layer>
    );
  };

  const LinkShape = (props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
    return (
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={payload.target.color}
        strokeOpacity={0.22}
        strokeWidth={Math.max(1, linkWidth)}
      >
        <title>{`${payload.source.name} → ${payload.target.name}: ${payload.value}`}</title>
      </path>
    );
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey data={clean} node={<NodeShape />} link={<LinkShape />} nodePadding={18} nodeWidth={10} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} iterations={64}>
          <Tooltip content={<SankeyTip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}

function SankeyTip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const inner = item?.payload?.payload ?? item?.payload;
  const label: string | undefined =
    inner?.source?.name && inner?.target?.name ? `${inner.source.name} → ${inner.target.name}` : typeof item?.name === 'string' ? item.name.replace(' - ', ' → ') : inner?.name;
  const value = item?.value ?? inner?.value;
  if (!label || value === undefined) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-1.5 text-[12px] shadow-lift">
      {label}: <b>{value}</b>
    </div>
  );
}
