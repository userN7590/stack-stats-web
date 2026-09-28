"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import {
  baselinePath,
  FINGERPRINT_HOURS,
  fingerprintFrame,
  formatFingerprintDate,
  formatUtcHour,
  formatUtcHourRange,
  heroLayout,
  hourX,
  nearestRidge,
  ridgeHeights,
  ridgePath,
  stipplePath,
  summarizeFingerprint,
  weekdayName,
  type FingerprintFrame,
  type FingerprintLayout,
  type FingerprintMeasure,
  type FingerprintModel,
  type RidgeFrame,
} from "@/lib/activity-fingerprint";
import { formatDurationMs, formatNumber } from "@/lib/format";

export type FingerprintSelection = { ridge: number; hour: number };
export type FingerprintDateStyle = "calendar" | "relative";

const measureLabels: Record<FingerprintMeasure, string> = { activeMs: "coding time", editCount: "content changes", linesAdded: "lines added", linesRemoved: "lines removed" };
export const formatFingerprintValue = (value: number, measure: FingerprintMeasure) => measure === "activeMs" ? formatDurationMs(value) : formatNumber(value);

// Depth shading, back → front. Integer channel mixing keeps SSR/hydration identical.
const BACK = [0x33, 0x32, 0x2c], FRONT = [0xd4, 0xd0, 0xc4];
export function depthInk(index: number, count: number) {
  const linear = count > 1 ? index / (count - 1) : 1;
  const t = linear * linear * 0.55 + linear * 0.45;
  return `#${BACK.map((channel, i) => Math.round(channel + (FRONT[i] - channel) * t).toString(16).padStart(2, "0")).join("")}`;
}

export function ridgeLabel(model: FingerprintModel, index: number, dateStyle: FingerprintDateStyle) {
  const ridge = model.ridges[index];
  return `${weekdayName(ridge)} · ${dateStyle === "relative" ? `day ${String(index + 1).padStart(2, "0")}` : formatFingerprintDate(ridge.date)}`;
}

/** Exact readout for one date/hour. Unavailable and missing are never zero. */
export function describeSelection(model: FingerprintModel, selection: FingerprintSelection, dateStyle: FingerprintDateStyle) {
  const ridge = model.ridges[selection.ridge];
  const label = ridgeLabel(model, selection.ridge, dateStyle);
  if (ridge.status === "missing") return `${label} — no record for this date (not measured zero)`;
  if (ridge.status === "unavailable") return `${label} — uploaded without hourly data (unavailable, not zero)`;
  return `${label} — ${formatUtcHourRange(selection.hour)} — ${formatFingerprintValue(ridge.values![selection.hour], model.measure)} ${measureLabels[model.measure]}`;
}

export function describeFingerprint(model: FingerprintModel, dateStyle: FingerprintDateStyle) {
  if (!model.ridges.length) return "No dates in this window.";
  const summary = summarizeFingerprint(model);
  const span = dateStyle === "relative" ? `${model.ridges.length} consecutive UTC dates` : `${model.ridges.length} UTC dates, ${formatFingerprintDate(model.from)} – ${formatFingerprintDate(model.to)}`;
  const parts = [`${model.observedDays} with hourly observations`];
  if (model.zeroDays) parts.push(`${model.zeroDays} of them observed zero`);
  if (model.unavailableDays) parts.push(`${model.unavailableDays} uploaded without hourly data`);
  if (model.missingDays) parts.push(`${model.missingDays} without a record`);
  const peak = summary.busiestHour === null ? "No activity was observed." : `Busiest hour overall: ${formatUtcHourRange(summary.busiestHour)}.`;
  return `${span}: ${parts.join(", ")}. ${peak}`;
}

function missingPath(frame: FingerprintFrame, ridge: RidgeFrame) {
  // Two short end ticks mark an empty slot: a date with no record at all.
  const left = Math.round((ridge.left - frame.layout.tail) * 100) / 100, right = Math.round((ridge.right + frame.layout.tail) * 100) / 100, y = Math.round(ridge.baseline * 100) / 100;
  return `M${left},${y} l0,-4 M${right},${y} l0,-4`;
}

type Engine = {
  frameId: number; strength: number; targetStrength: number; skew: number; targetSkew: number;
  targetRidge: number; targetHour: number; focus: number[]; kick: () => void;
};

export function ActivityFingerprint({
  model,
  layout = heroLayout,
  title,
  sourceNote,
  dateStyle = "calendar",
  rise = true,
  controls,
  className = "",
}: {
  model: FingerprintModel;
  layout?: FingerprintLayout;
  title: string;
  /** Visible provenance, e.g. “Representative example data — not your activity.” */
  sourceNote: ReactNode;
  dateStyle?: FingerprintDateStyle;
  rise?: boolean;
  controls?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<FingerprintSelection | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const frame = useMemo(() => fingerprintFrame(model, layout), [model, layout]);
  const heights = useMemo(() => model.ridges.map((ridge) => ridgeHeights(ridge, model, layout)), [model, layout]);
  const paths = useMemo(() => model.ridges.map((ridge, index) => ridge.status === "observed"
    ? ridgePath(frame, frame.ridges[index], heights[index])
    : ridge.status === "unavailable" ? baselinePath(frame, frame.ridges[index]) : missingPath(frame, frame.ridges[index])), [model, frame, heights]);
  const summary = useMemo(() => summarizeFingerprint(model), [model]);
  const restRidge = summary.busiestDay ? model.ridges.indexOf(summary.busiestDay) : null;
  const accent = active?.ridge ?? restRidge;
  const description = useMemo(() => describeFingerprint(model, dateStyle), [model, dateStyle]);
  const front = frame.ridges.at(-1), back = frame.ridges[0];

  // Interaction engine: refs only, so pointer motion never re-renders geometry.
  // `live` mirrors the latest render for the rAF loop and effect callbacks.
  const engine = useRef<Engine | null>(null);
  const motion = useRef({ allowed: false, visible: true });
  const live = useRef({ model, layout, frame, heights, paths, accent, active });
  useLayoutEffect(() => {
    live.current = { model, layout, frame, heights, paths, accent, active };
    // A newly committed stipple/cursor starts at rest; while geometry is held
    // deformed, one frame re-applies it (the loop still terminates).
    if (engine.current && engine.current.strength > 0) engine.current.kick();
  });

  useEffect(() => {
    const elements = () => {
      const svg = svgRef.current;
      return svg ? { ridges: svg.querySelectorAll<SVGPathElement>("[data-ridge]"), stipple: svg.querySelector<SVGPathElement>("[data-stipple]"), cursor: svg.querySelector<SVGGElement>("[data-cursor]") } : null;
    };
    /** Exact resting geometry: identical to the server-rendered markup. */
    const restore = () => {
      const nodes = elements(), current = live.current;
      if (!nodes) return;
      nodes.ridges.forEach((node) => node.setAttribute("d", current.paths[Number(node.dataset.ridge)]));
      if (nodes.stipple && current.accent !== null) nodes.stipple.setAttribute("d", stipplePath(current.frame, current.frame.ridges[current.accent], current.heights[current.accent]));
      nodes.cursor?.removeAttribute("transform");
    };
    const settle = () => {
      const state = engine.current;
      if (!state) return;
      if (state.frameId) cancelAnimationFrame(state.frameId);
      Object.assign(state, { frameId: 0, strength: 0, targetStrength: 0, skew: 1, targetSkew: 1 });
      restore();
    };
    const render = (state: Engine) => {
      const nodes = elements(), { model, layout, frame, heights, accent, active } = live.current;
      if (!nodes) return;
      const moving = fingerprintFrame(model, layout, state.skew);
      nodes.ridges.forEach((node) => {
        const i = Number(node.dataset.ridge), ridge = model.ridges[i], ridgeFrame = moving.ridges[i];
        if (ridge.status !== "observed") { node.setAttribute("d", ridge.status === "unavailable" ? baselinePath(moving, ridgeFrame) : missingPath(moving, ridgeFrame)); return; }
        const distance = i - state.targetRidge;
        const weight = state.strength * 0.34 * Math.exp(-(distance * distance) / 11.5);
        const deformed = weight > 0.002
          ? ridgeHeights(ridge, model, layout, (hour) => { const offset = hour + 0.5 - state.focus[i]; return 1 + weight * Math.exp(-(offset * offset) / 13.5); })
          : heights[i];
        node.setAttribute("d", ridgePath(moving, ridgeFrame, deformed));
        if (i !== accent) return;
        nodes.stipple?.setAttribute("d", stipplePath(moving, ridgeFrame, deformed));
        if (nodes.cursor && active?.ridge === i) {
          const dx = hourX(moving, ridgeFrame, active.hour + 0.5) - hourX(frame, frame.ridges[i], active.hour + 0.5);
          const dy = heights[i][active.hour] - deformed[active.hour];
          nodes.cursor.setAttribute("transform", `translate(${Math.round(dx * 100) / 100} ${Math.round(dy * 100) / 100})`);
        }
      });
    };
    const step = () => {
      const state = engine.current;
      if (!state) return;
      state.frameId = 0;
      // Ease toward targets, snapping once a change is no longer visible so the
      // loop always terminates; nothing is scheduled while idle or held still.
      state.strength += (state.targetStrength - state.strength) * 0.16;
      state.skew += (state.targetSkew - state.skew) * 0.12;
      let moving = true;
      if (Math.abs(state.targetStrength - state.strength) < 0.003) { state.strength = state.targetStrength; moving = false; }
      if (Math.abs(state.targetSkew - state.skew) < 0.0008) state.skew = state.targetSkew; else moving = true;
      if (state.strength > 0) {
        state.focus.forEach((focus, i) => {
          const distance = Math.abs(i - state.targetRidge);
          // Beyond this radius the deformation weight is imperceptible.
          if (distance > 8) { state.focus[i] = state.targetHour; return; }
          // Farther ridges follow later: horizontal motion propagates in depth.
          const next = focus + (state.targetHour - focus) * (0.3 / (1 + 0.45 * distance));
          if (Math.abs(state.targetHour - next) < 0.02) state.focus[i] = state.targetHour;
          else { state.focus[i] = next; moving = true; }
        });
      }
      if (!moving && state.targetStrength === 0) { settle(); return; }
      render(state);
      if (moving) state.frameId = requestAnimationFrame(step);
    };
    engine.current = { frameId: 0, strength: 0, targetStrength: 0, skew: 1, targetSkew: 1, targetRidge: 0, targetHour: 12, focus: model.ridges.map(() => 12), kick: () => {
      const state = engine.current;
      if (state && !state.frameId && motion.current.allowed && motion.current.visible) state.frameId = requestAnimationFrame(step);
    } };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      motion.current.allowed = !reduce.matches;
      if (stageRef.current) stageRef.current.dataset.motion = reduce.matches ? "reduced" : "full";
      if (reduce.matches) settle();
    };
    sync();
    reduce.addEventListener("change", sync);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      motion.current.visible = entry.isIntersecting;
      if (stageRef.current) stageRef.current.dataset.visible = String(entry.isIntersecting);
      if (!entry.isIntersecting) settle();
    });
    if (stageRef.current) {
      observer?.observe(stageRef.current);
      // Signals that pointer/keyboard enhancement is attached (tests, tooling).
      stageRef.current.dataset.interactive = "true";
    }
    const hidden = () => { if (document.hidden) settle(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      reduce.removeEventListener("change", sync);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", hidden);
      if (engine.current?.frameId) cancelAnimationFrame(engine.current.frameId);
      engine.current = null;
    };
  }, [model]);

  const kick = () => engine.current?.kick();

  function hitTest(event: PointerEvent<HTMLDivElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (event.clientX - rect.left) / rect.width * layout.width, y = (event.clientY - rect.top) / rect.height * layout.height;
    const hit = nearestRidge(model, frame, x, y);
    return hit ? { hit, x, y } : null;
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const result = hitTest(event);
    if (!result) return;
    const { hit, x, y } = result;
    setActive((previous) => previous?.ridge === hit.ridge && previous.hour === hit.hour ? previous : hit);
    const state = engine.current;
    if (!state || !motion.current.allowed) return;
    // A pointer over the stage proves it is on screen, even if the observer's
    // first report predates layout (e.g. late CSS). The observer still pauses it.
    motion.current.visible = true;
    state.targetRidge = hit.ridge;
    state.targetHour = (x - frame.ridges[hit.ridge].left) / frame.plotWidth * FINGERPRINT_HOURS;
    state.targetStrength = 1;
    // Vertical position nudges perspective only slightly.
    state.targetSkew = 1 + 0.2 * (0.5 - y / layout.height);
    kick();
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    setActive(null);
    const state = engine.current;
    if (state) { state.targetStrength = 0; state.targetSkew = 1; }
    kick();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // Touch: a tap highlights the nearest date, statically. Scrolling is untouched.
    if (event.pointerType !== "touch") return;
    const result = hitTest(event);
    if (result) setActive((previous) => previous?.ridge === result.hit.ridge && previous.hour === result.hit.hour ? null : result.hit);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!model.ridges.length) return;
    if (event.key === "Escape") { setActive(null); return; }
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = moves[event.key];
    if (!move && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    setActive((previous) => {
      const base = previous ?? { ridge: restRidge ?? model.ridges.length - 1, hour: summary.busiestDay?.peakHour ?? 12 };
      if (event.key === "Home") return { ...base, hour: 0 };
      if (event.key === "End") return { ...base, hour: FINGERPRINT_HOURS - 1 };
      return {
        ridge: Math.min(model.ridges.length - 1, Math.max(0, base.ridge + move[0])),
        hour: Math.min(FINGERPRINT_HOURS - 1, Math.max(0, base.hour + move[1])),
      };
    });
  }

  const readout = active
    ? describeSelection(model, active, dateStyle)
    : summary.busiestDay && restRidge !== null
      ? `Highlighted: busiest day, ${ridgeLabel(model, restRidge, dateStyle)} — ${formatFingerprintValue(summary.busiestDay.total!, model.measure)} ${measureLabels[model.measure]}, peak ${formatUtcHour(summary.busiestDay.peakHour!)} UTC`
      : "No hourly activity observed in this window.";
  const cursor = active && model.ridges[active.ridge].status === "observed" ? (() => {
    const ridgeFrame = frame.ridges[active.ridge];
    const x = hourX(frame, ridgeFrame, active.hour + 0.5);
    return { x: Math.round(x * 100) / 100, y: Math.round((ridgeFrame.baseline - heights[active.ridge][active.hour]) * 100) / 100, base: Math.round(ridgeFrame.baseline * 100) / 100 };
  })() : null;
  const percent = (value: number, total: number) => `${Math.round(value / total * 10000) / 100}%`;

  return (
    <figure className={`fp ${className}`} data-fingerprint="" data-ridges={model.ridges.length}>
      <div
        ref={stageRef}
        className="fp-stage"
        style={{ ["--fp-aspect" as string]: `${layout.width} / ${layout.height}` }}
        tabIndex={model.ridges.length ? 0 : undefined}
        role="group"
        aria-label={`${title}. Explore with arrow keys: up and down move between dates, left and right between UTC hours.`}
        aria-describedby={`${id}-readout`}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <svg ref={svgRef} viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" className={`fp-svg ${rise ? "fp-rise" : ""}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
          <title id={`${id}-title`}>{title}</title>
          <desc id={`${id}-desc`}>{description}</desc>
          {model.ridges.map((ridge, index) => (
            <g key={ridge.date} className="fp-ridge-group" style={{ ["--i" as string]: index }}>
              <path
                data-ridge={index}
                data-status={ridge.status}
                d={paths[index]}
                className={`fp-${ridge.status}${index === accent && ridge.status === "observed" ? " is-accent" : ""}`}
                stroke={ridge.status === "observed" ? depthInk(index, model.ridges.length) : undefined}
              />
              {index === accent && ridge.status === "observed" && <path data-stipple="" className="fp-stipple" d={stipplePath(frame, frame.ridges[index], heights[index])} />}
            </g>
          ))}
          {front && (
            <g aria-hidden="true" className="fp-axis">
              <path d={Array.from({ length: FINGERPRINT_HOURS + 1 }, (_, hour) => `M${Math.round(hourX(frame, front, hour) * 100) / 100},${Math.round((front.baseline + 7) * 100) / 100} v${hour % 6 ? 3 : 7}`).join(" ")} />
              {back && back !== front && <path className="fp-depth" d={`M${Math.round((back.right + layout.tail + 8) * 100) / 100},${Math.round(back.baseline * 100) / 100} L${Math.round((front.right + layout.tail + 8) * 100) / 100},${Math.round(front.baseline * 100) / 100}`} />}
            </g>
          )}
          {cursor && (
            <g data-cursor="" className="fp-cursor" aria-hidden="true">
              <path d={`M${cursor.x},${cursor.base} V${cursor.y}`} />
              <path className="fp-cursor-dot" d={`M${cursor.x},${cursor.y}h0`} />
            </g>
          )}
        </svg>
        {front && (
          <div aria-hidden="true" className="fp-labels">
            {[0, 6, 12, 18, 24].map((hour) => (
              <span key={hour} className="fp-hour" style={{ left: percent(hourX(frame, front, hour), layout.width), top: percent(front.baseline + 16, layout.height) }}>
                {hour === 24 ? "24h" : String(hour).padStart(2, "0")}
              </span>
            ))}
            <span className="fp-hour fp-utc" style={{ left: percent(hourX(frame, front, 24), layout.width), top: percent(front.baseline + 30, layout.height) }}>UTC</span>
            {back && back !== front && <>
              <span className="fp-date fp-date-back" style={{ left: percent(back.right + layout.tail + 8, layout.width), top: percent(back.baseline, layout.height) }}>
                {dateStyle === "relative" ? "day 01" : formatFingerprintDate(model.ridges[0].date)}
              </span>
              <span className="fp-date fp-date-front" style={{ left: percent(front.right + layout.tail + 8, layout.width), top: percent(front.baseline, layout.height) }}>
                {dateStyle === "relative" ? `day ${String(model.ridges.length).padStart(2, "0")}` : formatFingerprintDate(model.ridges.at(-1)!.date)}
              </span>
            </>}
          </div>
        )}
      </div>

      <figcaption className="fp-caption">
        <div className="fp-caption-main">
          <p className="fp-legend">
            <span>Ridge = one UTC date</span>
            <span>x = hour of day, UTC</span>
            <span>height = {measureLabels[model.measure]}</span>
            <span>front = most recent</span>
          </p>
          <div className="fp-source">{sourceNote}</div>
        </div>
        <p id={`${id}-readout`} className="fp-readout" aria-live="polite">{readout}</p>
        {controls && <div className="fp-controls">{controls}</div>}
        <details className="fp-values">
          <summary>Values by date (UTC)</summary>
          <p className="fp-values-note">{description}</p>
          <div className="fp-table-scroll">
            <table>
              <caption className="sr-only">{title}: {measureLabels[model.measure]} per UTC date</caption>
              <thead><tr><th scope="col">UTC date</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col">Busiest hour</th></tr></thead>
              <tbody>
                {model.ridges.map((ridge, index) => (
                  <tr key={ridge.date}>
                    <th scope="row">{ridgeLabel(model, index, dateStyle)}</th>
                    <td>{ridge.status === "observed" ? ridge.total === 0 ? "Observed zero" : "Observed" : ridge.status === "unavailable" ? "Hourly data unavailable" : "No record"}</td>
                    <td>{ridge.status === "observed" ? formatFingerprintValue(ridge.total!, model.measure) : "—"}</td>
                    <td>{ridge.peakHour === null ? "—" : formatUtcHourRange(ridge.peakHour)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showMatrix ? (
            <div className="fp-table-scroll">
              <table className="fp-matrix">
                <caption className="sr-only">{measureLabels[model.measure]} per UTC date and UTC hour</caption>
                <thead><tr><th scope="col">UTC date</th>{Array.from({ length: FINGERPRINT_HOURS }, (_, hour) => <th key={hour} scope="col">{String(hour).padStart(2, "0")}</th>)}</tr></thead>
                <tbody>
                  {model.ridges.map((ridge, index) => (
                    <tr key={ridge.date}>
                      <th scope="row">{ridgeLabel(model, index, dateStyle)}</th>
                      {ridge.values ? ridge.values.map((value, hour) => <td key={hour}>{formatFingerprintValue(value, model.measure)}</td>) : <td colSpan={FINGERPRINT_HOURS}>{ridge.status === "unavailable" ? "Hourly data unavailable" : "No record"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <button type="button" className="fp-matrix-toggle" onClick={() => setShowMatrix(true)}>Show all hourly values</button>
          )}
        </details>
      </figcaption>
    </figure>
  );
}
