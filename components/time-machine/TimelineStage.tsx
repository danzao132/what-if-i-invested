"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { indexOnOrAfter, sampleIndices, type PreparedSeries } from "@/lib/engine/series";
import { dateFromDay, yearOfDay } from "@/lib/engine/dates";
import { fmtDay, fmtMonthYear, money, pct } from "@/lib/format";
import { useElementWidth } from "../ui/hooks";

/**
 * The signature interaction: a price-history "landscape" with the time
 * machine slider bolted directly underneath. Chart and slider share ONE
 * horizontal scale (calendar days), so the dashed marker always runs from
 * the purchase point on the curve straight down into the slider handle.
 *
 * Everything during a drag is local: the price path is computed once per
 * series/size, and a drag only moves a clip rectangle, a marker and a label.
 */

const SIDE = 22; // horizontal inset so the handle never clips at the edges
const CHART_H = 230;
const CHART_H_SM = 180;

export interface TimelineStageProps {
  series: PreparedSeries;
  startIndex: number;
  amount: number;
  value: number;
  onChangeIndex: (index: number, source: "drag" | "key" | "click") => void;
  onDragState?: (dragging: boolean) => void;
  logScale: boolean;
  companyLabel: string;
  mode: "price" | "total";
}

export function TimelineStage({
  series,
  startIndex,
  amount,
  value,
  onChangeIndex,
  onDragState,
  logScale,
  companyLabel,
  mode,
}: TimelineStageProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(360);
  const chartH = width < 520 ? CHART_H_SM : CHART_H;
  const days = series.days;
  const n = days.length;
  const maxIndex = Math.max(0, n - 2);
  const d0 = days[0];
  const d1 = days[n - 1];
  const innerW = width - SIDE * 2;
  const xOfDay = useCallback((d: number) => SIDE + ((d - d0) / (d1 - d0 || 1)) * innerW, [d0, d1, innerW]);
  const dayOfX = useCallback((x: number) => d0 + ((x - SIDE) / (innerW || 1)) * (d1 - d0), [d0, d1, innerW]);
  const clipId = useId().replace(/:/g, "");

  const S = mode === "total" && series.tr ? series.tr : series.price;

  // ---- static geometry: the full-history curve ----------------------------
  const geo = useMemo(() => {
    const idx = sampleIndices(0, n - 1, Math.min(n, Math.max(300, Math.round(innerW * 1.5))));
    let lo = Infinity;
    let hi = -Infinity;
    for (const i of idx) {
      const v = S[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const f = (v: number) => (logScale ? Math.log10(v) : v);
    const flo = f(lo);
    const fhi = f(hi);
    const top = 18;
    const bottom = chartH - 10;
    const yOf = (v: number) => bottom - ((f(v) - flo) / (fhi - flo || 1)) * (bottom - top);
    let d = "";
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      d += `${k ? "L" : "M"}${xOfDay(days[i]).toFixed(1)},${yOf(S[i]).toFixed(1)}`;
    }
    const area = `${d}L${xOfDay(d1).toFixed(1)},${chartH}L${xOfDay(d0).toFixed(1)},${chartH}Z`;
    return { d, area, yOf };
  }, [S, n, innerW, logScale, chartH, xOfDay, days, d0, d1]);

  // ---- year ticks + split milestones ---------------------------------------
  const ticks = useMemo(() => {
    const spanYears = (d1 - d0) / 365.25;
    const maxTicks = Math.max(2, Math.floor(innerW / 52));
    const step = [1, 2, 5, 10, 20].find((s) => spanYears / s <= maxTicks) ?? 25;
    const out: { day: number; label: string; major: boolean }[] = [];
    const y0 = dateFromDay(d0).getUTCFullYear() + 1;
    for (let y = y0; ; y++) {
      const day = Math.round(Date.UTC(y, 0, 1) / 86_400_000);
      if (day > d1) break;
      const major = y % step === 0;
      if (major || spanYears < 40) out.push({ day, label: String(y), major });
    }
    return out;
  }, [d0, d1, innerW]);

  const splits = useMemo(
    () => series.history.splits.filter((s) => s.day > d0 && s.day <= d1),
    [series.history.splits, d0, d1],
  );

  // ---- drag handling -------------------------------------------------------
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const pending = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const lastYear = useRef<number | null>(null);

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current!.getBoundingClientRect();
      const x = clientX - rect.left;
      const day = Math.round(dayOfX(x));
      let i = indexOnOrAfter(days, Math.max(d0, day));
      if (i < 0) i = maxIndex;
      return Math.min(i, maxIndex);
    },
    [dayOfX, days, d0, maxIndex],
  );

  const flush = useCallback(() => {
    raf.current = null;
    if (pending.current == null) return;
    const i = pending.current;
    pending.current = null;
    const y = yearOfDay(days[i]);
    if (lastYear.current != null && y !== lastYear.current && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(4);
      } catch {}
    }
    lastYear.current = y;
    onChangeIndex(i, "drag");
  }, [days, onChangeIndex]);

  const schedule = (i: number) => {
    pending.current = i;
    if (raf.current == null) raf.current = requestAnimationFrame(flush);
  };

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    onDragState?.(true);
    lastYear.current = yearOfDay(days[startIndex]);
    schedule(indexFromClientX(e.clientX));
    handleRef.current?.focus({ preventScroll: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    schedule(indexFromClientX(e.clientX));
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    onDragState?.(false);
  };

  // ---- keyboard ------------------------------------------------------------
  const handleRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const year = 252;
    const month = 21;
    let next = startIndex;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next -= e.shiftKey ? year : 1;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next += e.shiftKey ? year : 1;
        break;
      case "PageDown":
        next -= e.shiftKey ? year : month;
        break;
      case "PageUp":
        next += e.shiftKey ? year : month;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = maxIndex;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChangeIndex(Math.max(0, Math.min(maxIndex, next)), "key");
  };

  // ---- derived positions ---------------------------------------------------
  const startDay = days[startIndex];
  const hx = xOfDay(startDay);
  const py = geo.yOf(S[startIndex]);
  const endY = geo.yOf(S[n - 1]);
  const up = value >= amount;
  const lineColor = up ? "var(--gain)" : "var(--loss)";
  const progress = (startDay - d0) / (d1 - d0 || 1);
  const labelW = dragging ? 172 : 132;
  const labelLeft = Math.min(Math.max(hx - labelW / 2, 0), width - labelW);

  // Hover ghost (mouse only) on the chart: "what was it worth back then?"
  const [ghost, setGhost] = useState<{ x: number; i: number } | null>(null);
  const onChartMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse" || dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const day = dayOfX(e.clientX - rect.left);
    let i = indexOnOrAfter(days, Math.round(day));
    if (i < 0) i = n - 1;
    setGhost({ x: xOfDay(days[i]), i });
  };
  const onChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let i = indexOnOrAfter(days, Math.round(dayOfX(e.clientX - rect.left)));
    if (i < 0) i = maxIndex;
    onChangeIndex(Math.min(i, maxIndex), "click");
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* ---------------- chart ---------------- */}
      <svg
        width={width}
        height={chartH}
        className="block cursor-pointer touch-pan-y"
        onPointerMove={onChartMove}
        onPointerLeave={() => setGhost(null)}
        onClick={onChartClick}
        role="img"
        aria-label={`${companyLabel} price history from ${fmtDay(d0)} to ${fmtDay(d1)}${logScale ? " (log scale)" : ""}. Highlighted: your investment from ${fmtDay(startDay)}.`}
      >
        <defs>
          <clipPath id={`${clipId}-after`}>
            <rect x={hx} y={0} width={Math.max(0, width - hx)} height={chartH} />
          </clipPath>
          <clipPath id={`${clipId}-before`}>
            <rect x={0} y={0} width={hx} height={chartH} />
          </clipPath>
          <linearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${clipId}-past`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--past)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--past)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* The past you skipped: muted violet. */}
        <g clipPath={`url(#${clipId}-before)`}>
          <path d={geo.area} fill={`url(#${clipId}-past)`} />
          <path d={geo.d} fill="none" stroke="var(--past)" strokeOpacity={0.45} strokeWidth={1.5} strokeLinejoin="round" />
        </g>
        {/* Your money's journey: gain/loss coloured. */}
        <g clipPath={`url(#${clipId}-after)`}>
          <path d={geo.area} fill={`url(#${clipId}-fill)`} />
          <path d={geo.d} fill="none" stroke={lineColor} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        </g>

        {/* Marker: purchase point → down into the slider label. */}
        <line x1={hx} x2={hx} y1={py} y2={chartH} stroke="var(--accent)" strokeWidth={2} strokeDasharray="3 4" />
        <circle cx={hx} cy={py} r={9} fill="var(--accent)" opacity={0.22} />
        <circle cx={hx} cy={py} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />

        {/* Present-day endpoint. */}
        <circle cx={xOfDay(d1)} cy={endY} r={4.5} fill={lineColor} stroke="var(--surface)" strokeWidth={2} />

        {ghost && (
          <g pointerEvents="none">
            <line x1={ghost.x} x2={ghost.x} y1={0} y2={chartH} stroke="var(--ink-3)" strokeOpacity={0.5} />
            <circle cx={ghost.x} cy={geo.yOf(S[ghost.i])} r={3.5} fill="var(--ink-2)" />
          </g>
        )}
        {logScale && (
          <text x={width - SIDE} y={14} textAnchor="end" fontSize={10} fill="var(--ink-3)">
            log scale
          </text>
        )}
      </svg>

      {ghost && (
        <GhostTip
          x={ghost.x}
          width={width}
          day={days[ghost.i]}
          before={ghost.i < startIndex}
          worth={(amount * S[ghost.i]) / S[startIndex]}
          gain={S[ghost.i] / S[startIndex] - 1}
          price={series.price[ghost.i]}
        />
      )}

      {/* ---------------- slider ---------------- */}
      <div className="relative h-[34px]">
        <div
          className="absolute top-1 flex h-7 items-center justify-center rounded-full bg-ink px-3 text-[13px] font-semibold text-bg tnum shadow-card"
          style={{ left: labelLeft, width: labelW, transition: dragging ? "none" : "left 120ms ease-out" }}
          aria-hidden
        >
          {fmtDay(startDay)}
          {dragging && <span className="ml-2 border-l border-bg/30 pl-2">{money(value)}</span>}
        </div>
      </div>
      <div
        ref={trackRef}
        className="relative h-14 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        {/* rail */}
        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-3" style={{ left: SIDE, right: SIDE }} />
        {/* travelled period: handle → now */}
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
          style={{
            left: hx,
            right: SIDE,
            background: "linear-gradient(90deg, var(--accent), var(--past))",
            boxShadow: "0 0 18px -2px var(--accent-soft)",
          }}
        />
        {/* year ticks */}
        {ticks.map((t) => (
          <div
            key={t.day}
            className="absolute top-1/2 w-px -translate-x-1/2 bg-ink-3"
            style={{ left: xOfDay(t.day), height: t.major ? 14 : 6, marginTop: t.major ? 6 : 6, opacity: t.major ? 0.5 : 0.25 }}
          />
        ))}
        {/* verified corporate actions from the data feed */}
        {splits.map((s) => (
          <div
            key={s.day}
            title={`${s.ratio >= 1 ? `${+s.ratio.toFixed(3)}-for-1 split` : `1-for-${+(1 / s.ratio).toFixed(3)} reverse split`} · ${fmtDay(s.day)}`}
            className="absolute top-[14px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-past"
            style={{ left: xOfDay(s.day) }}
          />
        ))}
        {/* handle */}
        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label="Investment date"
          aria-valuemin={0}
          aria-valuemax={maxIndex}
          aria-valuenow={startIndex}
          aria-valuetext={`${fmtDay(startDay)}: ${money(amount)} would be ${money(value)} today`}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none"
          style={{ left: hx, transition: dragging ? "none" : "left 120ms ease-out" }}
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-surface bg-accent text-[#1b1406] shadow-card transition-transform"
            style={{
              transform: `scale(${dragging ? 1.12 : 1})`,
              boxShadow: dragging ? "0 0 0 8px var(--accent-soft), var(--shadow)" : "var(--shadow)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ transform: `rotate(${progress * 720}deg)` }}>
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 12V6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M12 12l3.2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </div>
      {/* year labels */}
      <div className="relative h-5 text-[11px] text-ink-3 tnum" aria-hidden>
        {ticks
          .filter((t) => t.major)
          .map((t) => (
            <span key={t.day} className="absolute -translate-x-1/2" style={{ left: xOfDay(t.day) }}>
              {t.label}
            </span>
          ))}
        <span className="absolute right-0 font-bold tracking-wider text-accent-ink">NOW</span>
      </div>
    </div>
  );
}

function GhostTip(props: { x: number; width: number; day: number; before: boolean; worth: number; gain: number; price: number }) {
  const w = 190;
  const left = Math.min(Math.max(props.x - w / 2, 0), props.width - w);
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card"
      style={{ left, width: w }}
    >
      <div className="font-medium text-ink-2">{fmtMonthYear(props.day)} · {fmtDay(props.day)}</div>
      {props.before ? (
        <div className="mt-0.5 text-ink-3">
          Before your investment · share price {props.price < 1 ? "$" + props.price.toPrecision(3) : "$" + props.price.toFixed(2)}
          <div className="mt-1 text-ink-2">Click to travel here</div>
        </div>
      ) : (
        <div className="mt-0.5">
          <span className="font-semibold text-ink tnum">{money(props.worth)}</span>{" "}
          <span className={props.gain >= 0 ? "text-gain" : "text-loss"}>{pct(props.gain)}</span>
          <div className="text-ink-3">your investment&apos;s value then</div>
        </div>
      )}
    </div>
  );
}
