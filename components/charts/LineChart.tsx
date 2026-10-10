"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { dateFromDay } from "@/lib/engine/dates";
import { useElementWidth } from "../ui/hooks";

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: ChartPoint[];
  area?: boolean;
  dashed?: boolean;
  strokeWidth?: number;
}

export interface LineChartProps {
  series: ChartSeries[];
  height?: number;
  /** "day" = DayNumber x values; "unix" = Unix seconds (intraday). */
  xKind?: "day" | "unix";
  yLog?: boolean;
  baseline?: { y: number; label?: string };
  formatY: (v: number) => string;
  renderTooltip?: (x: number, values: { series: ChartSeries; point: ChartPoint }[]) => ReactNode;
  volume?: { x: number; v: number }[];
  marker?: number;
  onSelectX?: (x: number) => void;
  ariaLabel: string;
  /** Pads the y-domain so lines never touch the edges. */
  yPadding?: number;
  className?: string;
}

const PAD = { top: 16, right: 56, bottom: 28, left: 8 };

function lowerBound(points: ChartPoint[], x: number) {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid].x < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].x - x) < Math.abs(points[lo].x - x)) return lo - 1;
  return lo;
}

function niceLinearTicks(min: number, max: number, count: number) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

function logTicks(min: number, max: number, count: number) {
  const out: number[] = [];
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const mults = hi - lo > count ? [1] : hi - lo > count / 2 ? [1, 3] : [1, 2, 5];
  for (let e = lo; e <= hi; e++) for (const m of mults) {
    const v = m * Math.pow(10, e);
    if (v >= min && v <= max) out.push(v);
  }
  return out;
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function xTicks(min: number, max: number, width: number, kind: "day" | "unix") {
  const maxTicks = Math.max(2, Math.floor(width / 84));
  const ticks: { x: number; label: string }[] = [];
  if (kind === "unix") {
    const spanH = (max - min) / 3600;
    const stepH = [1, 2, 3, 6, 12, 24].find((h) => spanH / h <= maxTicks) ?? 24;
    const start = Math.ceil(min / (stepH * 3600)) * stepH * 3600;
    const tf = new Intl.DateTimeFormat("en-US", stepH >= 24 ? { weekday: "short", timeZone: "America/New_York" } : { hour: "numeric", timeZone: "America/New_York" });
    for (let t = start; t <= max; t += stepH * 3600) ticks.push({ x: t, label: tf.format(new Date(t * 1000)) });
    return ticks;
  }
  const spanDays = max - min;
  const a = dateFromDay(min);
  if (spanDays > 365 * 2) {
    const years = spanDays / 365.25;
    const step = [1, 2, 5, 10, 20].find((s) => years / s <= maxTicks) ?? 25;
    let y = Math.ceil(a.getUTCFullYear() / step) * step;
    for (; ; y += step) {
      const d = Math.round(Date.UTC(y, 0, 1) / 86_400_000);
      if (d > max) break;
      if (d >= min) ticks.push({ x: d, label: String(y) });
    }
  } else if (spanDays > 60) {
    const months = spanDays / 30.4;
    const step = [1, 2, 3, 6].find((s) => months / s <= maxTicks) ?? 12;
    let y = a.getUTCFullYear();
    let m = a.getUTCMonth() + 1;
    for (let guard = 0; guard < 400; guard++) {
      if (m >= 12) {
        y += Math.floor(m / 12);
        m %= 12;
      }
      const d = Math.round(Date.UTC(y, m, 1) / 86_400_000);
      if (d > max) break;
      if (d >= min && m % step === 0) ticks.push({ x: d, label: m === 0 ? String(y) : monthFmt.format(dateFromDay(d)) });
      m += 1;
    }
  } else {
    const step = Math.max(1, Math.ceil(spanDays / maxTicks));
    for (let d = Math.ceil(min); d <= max; d += step) ticks.push({ x: d, label: dayFmt.format(dateFromDay(d)) });
  }
  return ticks;
}

/**
 * Small, dependency-free SVG line/area chart with scrub tooltips that work
 * for mouse, pen and touch (touch-action: pan-y keeps vertical page scroll).
 */
export function LineChart({
  series,
  height = 280,
  xKind = "day",
  yLog = false,
  baseline,
  formatY,
  renderTooltip,
  volume,
  marker,
  onSelectX,
  ariaLabel,
  yPadding = 0.08,
  className,
}: LineChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useId().replace(/:/g, "");

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (!all.length) return null;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of all) {
      if (p.x < xmin) xmin = p.x;
      if (p.x > xmax) xmax = p.x;
      if (p.y < ymin) ymin = p.y;
      if (p.y > ymax) ymax = p.y;
    }
    if (baseline) {
      ymin = Math.min(ymin, baseline.y);
      ymax = Math.max(ymax, baseline.y);
    }
    const log = yLog && ymin > 0;
    const volH = volume?.length ? 44 : 0;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom - volH;
    let y0: number, y1: number;
    if (log) {
      const l0 = Math.log10(ymin), l1 = Math.log10(ymax);
      const pad = (l1 - l0 || 1) * yPadding;
      y0 = l0 - pad;
      y1 = l1 + pad;
    } else {
      const pad = (ymax - ymin || Math.abs(ymax) || 1) * yPadding;
      y0 = ymin - pad;
      y1 = ymax + pad;
    }
    const sx = (x: number) => PAD.left + ((x - xmin) / (xmax - xmin || 1)) * plotW;
    const sy = (y: number) => {
      const v = log ? Math.log10(Math.max(y, 1e-12)) : y;
      return PAD.top + (1 - (v - y0) / (y1 - y0 || 1)) * plotH;
    };
    const paths = series.map((s) => {
      let d = "";
      s.points.forEach((p, i) => {
        d += `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
      });
      let area = "";
      if (s.area && s.points.length > 1) {
        const bottom = PAD.top + plotH;
        area = `${d}L${sx(s.points.at(-1)!.x).toFixed(1)},${bottom}L${sx(s.points[0].x).toFixed(1)},${bottom}Z`;
      }
      return { d, area };
    });
    const yt = log ? logTicks(Math.pow(10, y0), Math.pow(10, y1), 5) : niceLinearTicks(y0, y1, 4);
    let vbars: { x: number; h: number; w: number }[] = [];
    if (volume?.length) {
      const vmax = Math.max(...volume.map((v) => v.v)) || 1;
      const w = Math.max(1, plotW / volume.length - 0.5);
      vbars = volume.map((v) => ({ x: sx(v.x) - w / 2, h: (v.v / vmax) * (volH - 6), w }));
    }
    return { xmin, xmax, sx, sy, paths, yt, xt: xTicks(xmin, xmax, plotW, xKind), plotW, plotH, volH, vbars, log };
  }, [series, width, height, yLog, baseline, volume, xKind, yPadding]);

  if (!geo) return <div ref={wrapRef} style={{ height }} className="skeleton" />;

  const toX = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = Math.min(Math.max(clientX - rect.left, PAD.left), PAD.left + geo.plotW);
    return geo.xmin + ((px - PAD.left) / geo.plotW) * (geo.xmax - geo.xmin);
  };

  const hover =
    hoverX != null
      ? series
          .filter((s) => s.points.length)
          .map((s) => ({ series: s, point: s.points[lowerBound(s.points, hoverX)] }))
          .filter((h) => Math.abs(h.point.x - hoverX) <= (geo.xmax - geo.xmin) * 0.02 + 1)
      : [];
  const hx = hover[0] ? geo.sx(hover[0].point.x) : null;

  return (
    <div ref={wrapRef} className={`relative select-none ${className ?? ""}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="block touch-pan-y"
        onPointerMove={(e) => setHoverX(toX(e.clientX))}
        onPointerDown={(e) => setHoverX(toX(e.clientX))}
        onPointerLeave={() => setHoverX(null)}
        onPointerCancel={() => setHoverX(null)}
        onClick={(e) => onSelectX?.(toX(e.clientX))}
        style={{ cursor: onSelectX ? "pointer" : "crosshair" }}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.id} id={`${gid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {geo.yt.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.sy(t)} y2={geo.sy(t)} stroke="var(--line)" />
            <text x={PAD.left + geo.plotW + 8} y={geo.sy(t) + 4} fontSize={11} fill="var(--ink-3)" className="tnum">
              {formatY(t)}
            </text>
          </g>
        ))}
        {geo.xt.map((t) => (
          <text key={t.x} x={geo.sx(t.x)} y={height - 8} fontSize={11} fill="var(--ink-3)" textAnchor="middle">
            {t.label}
          </text>
        ))}
        {geo.vbars.map((b, i) => (
          <rect key={i} x={b.x} y={PAD.top + geo.plotH + geo.volH - b.h} width={b.w} height={b.h} fill="var(--ink-3)" opacity={0.28} />
        ))}
        {baseline && (
          <g>
            <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.sy(baseline.y)} y2={geo.sy(baseline.y)} stroke="var(--ink-3)" strokeDasharray="3 4" />
            {baseline.label && (
              <text x={PAD.left + 4} y={geo.sy(baseline.y) - 6} fontSize={11} fill="var(--ink-3)">
                {baseline.label}
              </text>
            )}
          </g>
        )}
        {series.map((s, i) => (
          <g key={s.id}>
            {s.area && <path d={geo.paths[i].area} fill={`url(#${gid}-g${i})`} />}
            <path
              d={geo.paths[i].d}
              fill="none"
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}
        {marker != null && marker >= geo.xmin && marker <= geo.xmax && (
          <line x1={geo.sx(marker)} x2={geo.sx(marker)} y1={PAD.top} y2={PAD.top + geo.plotH} stroke="var(--accent)" strokeWidth={2} strokeDasharray="2 3" />
        )}
        {hx != null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + geo.plotH} stroke="var(--ink-3)" strokeWidth={1} />
            {hover.map((h) => (
              <circle key={h.series.id} cx={geo.sx(h.point.x)} cy={geo.sy(h.point.y)} r={4.5} fill={h.series.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hx != null && renderTooltip && hover.length > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card"
          style={{ left: Math.min(Math.max(hx - 90, 0), width - 190), width: 180 }}
        >
          {renderTooltip(hover[0].point.x, hover)}
        </div>
      )}
    </div>
  );
}
