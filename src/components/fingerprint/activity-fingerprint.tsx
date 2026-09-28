"use client";

import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";

import {
  baselinePath,
  binPoint,
  depthInk,
  FINGERPRINT_HOURS,
  fingerprintFrame,
  formatFingerprintDate,
  formatUtcHourRange,
  heroLayout,
  hourX,
  localStipplePath,
  pickRidge,
  ridgeHeights,
  ridgePath,
  summarizeFingerprint,
  weekdayName,
  type FingerprintFrame,
  type FingerprintLayout,
  type FingerprintMeasure,
  type FingerprintModel,
  type RidgeFrame,
  type RidgeHit,
} from "@/lib/activity-fingerprint";
import { formatDurationMs, formatNumber } from "@/lib/format";

export type FingerprintSelection = RidgeHit;
export type FingerprintDateStyle = "calendar" | "relative";
export { depthInk };

const measureLabels: Record<FingerprintMeasure, string> = { activeMs: "coding time", editCount: "content changes", linesAdded: "lines added", linesRemoved: "lines removed" };
export const formatFingerprintValue = (value: number, measure: FingerprintMeasure) => measure === "activeMs" ? formatDurationMs(value) : formatNumber(value);

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

const fixed = (value: number) => Math.round(value * 100) / 100;
function missingPath(frame: FingerprintFrame, ridge: RidgeFrame) {
  // Two short end ticks mark an empty slot: a date with no record at all.
  return `M${fixed(ridge.left - frame.layout.tail)},${fixed(ridge.baseline)} l0,-4 M${fixed(ridge.right + frame.layout.tail)},${fixed(ridge.baseline)} l0,-4`;
}
/** Blue falls off along the ridge: this many UTC hours either side of focus. */
const ACCENT_HOURS = 3.4;

/**
 * Server-rendered ridgeline with an imperative interaction layer. Nothing in
 * pointer, touch or keyboard handling sets React state: selection, readout,
 * deformation and the local accent are DOM/SVG mutations, and animation
 * frames run only while something is still moving.
 */
export function ActivityFingerprint({
  model,
  layout = heroLayout,
  title,
  label,
  dateStyle = "calendar",
  rise = true,
  controls,
  className = "",
}: {
  model: FingerprintModel;
  layout?: FingerprintLayout;
  title: string;
  /** Short visible caption at rest, e.g. “30 days of coding · example data”. */
  label: string;
  dateStyle?: FingerprintDateStyle;
  rise?: boolean;
  controls?: ReactNode;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);

  const frame = useMemo(() => fingerprintFrame(model, layout), [model, layout]);
  const heights = useMemo(() => model.ridges.map((ridge) => ridgeHeights(ridge, model, layout)), [model, layout]);
  const paths = useMemo(() => model.ridges.map((ridge, index) => ridge.status === "observed"
    ? ridgePath(frame, frame.ridges[index], heights[index])
    : ridge.status === "unavailable" ? baselinePath(frame, frame.ridges[index]) : missingPath(frame, frame.ridges[index])), [model, frame, heights]);
  const summary = useMemo(() => summarizeFingerprint(model), [model]);
  const description = useMemo(() => describeFingerprint(model, dateStyle), [model, dateStyle]);
  // At rest the busiest day carries the accent, centred on its peak hour.
  const rest = useMemo<RidgeHit | null>(() => summary.busiestDay ? { ridge: model.ridges.indexOf(summary.busiestDay), hour: summary.busiestDay.peakHour! } : null, [model, summary]);
  const accentRadius = frame.plotWidth / FINGERPRINT_HOURS * ACCENT_HOURS;
  const restCentre = rest ? hourX(frame, frame.ridges[rest.ridge], rest.hour + 0.5) : 0;
  const front = frame.ridges.at(-1), back = frame.ridges[0];
  const percent = (value: number, total: number) => `${Math.round(value / total * 10000) / 100}%`;

  useEffect(() => {
    const svg = svgRef.current, stage = stageRef.current, readout = readoutRef.current;
    const gradient = svg?.querySelector<SVGLinearGradientElement>("[data-live-gradient]");
    if (!svg || !stage || !readout || !gradient || !model.ridges.length) return;
    const groups = Array.from(svg.querySelectorAll<SVGGElement>("[data-group]"));
    const ridgeNodes = Array.from(svg.querySelectorAll<SVGPathElement>("[data-ridge]"));
    const make = (className: string) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
      node.setAttribute("class", `${className} fp-live`);
      return node;
    };
    // Live accent nodes are appended inside the active ridge's own group, so
    // ridges in front of it occlude them exactly as they occlude its line.
    const live = { line: make("fp-accent-line"), stipple: make("fp-stipple"), halo: make("fp-marker-halo"), dot: make("fp-marker-dot") };
    live.line.setAttribute("stroke", `url(#${uid}-live)`);
    live.stipple.setAttribute("stroke", `url(#${uid}-live)`);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const restGlow = rest ? rest.hour + 0.5 : FINGERPRINT_HOURS / 2;
    const state = {
      frameId: 0, visible: true, inside: false, pending: null as { x: number; y: number } | null,
      selection: null as RidgeHit | null, strength: 0, targetStrength: 0, skew: 1, targetSkew: 1,
      focusRidge: rest?.ridge ?? 0, targetRidge: rest?.ridge ?? 0, targetHour: restGlow, focus: model.ridges.map(() => restGlow),
      glow: restGlow, glowTarget: restGlow, shownFrame: frame, shownHeights: heights as readonly (readonly number[])[], deformed: false,
    };
    const motion = () => !reduce.matches;
    stage.dataset.motion = reduce.matches ? "reduced" : "full";

    const select = (hit: RidgeHit | null) => {
      const previous = state.selection;
      if (!hit) {
        if (!previous) return;
        ridgeNodes[previous.ridge]?.classList.remove("is-active");
        svg.removeAttribute("data-engaged");
        stage.dataset.activeRidge = "";
        readout.textContent = label;
        state.selection = null;
        return;
      }
      if (previous?.ridge !== hit.ridge) {
        if (previous) ridgeNodes[previous.ridge]?.classList.remove("is-active");
        ridgeNodes[hit.ridge].classList.add("is-active");
        groups[hit.ridge].append(live.line, live.stipple, live.halo, live.dot);
        stage.dataset.activeRidge = String(hit.ridge);
        if (previous && motion()) for (const node of [live.line, live.stipple, live.dot]) node.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      }
      svg.setAttribute("data-engaged", "");
      if (previous?.ridge !== hit.ridge || previous.hour !== hit.hour) readout.textContent = describeSelection(model, hit, dateStyle);
      state.selection = hit;
    };

    const render = () => {
      const bend = state.strength > 0;
      const shownFrame = bend || state.skew !== 1 ? fingerprintFrame(model, layout, state.skew) : frame;
      const shownHeights = bend ? model.ridges.map((ridge, index) => {
        const distance = index - state.focusRidge;
        const weight = state.strength * 0.3 * Math.exp(-(distance * distance) / 11.5);
        if (ridge.status !== "observed" || weight < 0.002) return heights[index];
        return ridgeHeights(ridge, model, layout, (hour) => { const offset = hour + 0.5 - state.focus[index]; return 1 + weight * Math.exp(-(offset * offset) / 13.5); });
      }) : heights;
      if (shownFrame !== frame || bend) {
        ridgeNodes.forEach((node, index) => {
          const ridge = model.ridges[index], ridgeFrame = shownFrame.ridges[index];
          node.setAttribute("d", ridge.status === "observed" ? ridgePath(shownFrame, ridgeFrame, shownHeights[index]) : ridge.status === "unavailable" ? baselinePath(shownFrame, ridgeFrame) : missingPath(shownFrame, ridgeFrame));
        });
        state.deformed = true;
      } else if (state.deformed) {
        // Exact resting geometry: identical to the server-rendered markup.
        ridgeNodes.forEach((node, index) => node.setAttribute("d", paths[index]));
        state.deformed = false;
      }
      state.shownFrame = shownFrame;
      state.shownHeights = shownHeights;
      const selection = state.selection;
      if (!selection) return;
      const ridge = model.ridges[selection.ridge], ridgeFrame = shownFrame.ridges[selection.ridge], shown = shownHeights[selection.ridge];
      live.line.setAttribute("d", ridge.status === "observed" ? ridgePath(shownFrame, ridgeFrame, shown) : ridge.status === "unavailable" ? baselinePath(shownFrame, ridgeFrame) : missingPath(shownFrame, ridgeFrame));
      live.stipple.setAttribute("d", ridge.status === "observed" ? localStipplePath(shownFrame, ridgeFrame, shown, state.glow) : "");
      const point = binPoint(shownFrame, ridgeFrame, shown, selection.hour);
      live.halo.setAttribute("d", `M${point.x},${point.y}h0`);
      live.dot.setAttribute("d", `M${point.x},${point.y}h0`);
      const centre = hourX(shownFrame, ridgeFrame, state.glow);
      gradient.setAttribute("x1", String(fixed(centre - accentRadius)));
      gradient.setAttribute("x2", String(fixed(centre + accentRadius)));
    };

    const ease = (value: number, target: number, rate: number, snap: number) => Math.abs(target - value) < snap ? target : value + (target - value) * rate;
    const step = () => {
      state.frameId = 0;
      if (state.pending) {
        const { x, y } = state.pending;
        state.pending = null;
        // Hit-test what is on screen now (deformed, skewed), with hysteresis.
        const hit = pickRidge(state.shownFrame, state.shownHeights, x, y, state.selection?.ridge ?? null);
        if (hit) {
          select(hit);
          const ridgeFrame = state.shownFrame.ridges[hit.ridge];
          state.glowTarget = Math.min(FINGERPRINT_HOURS, Math.max(0, (x - ridgeFrame.left) / state.shownFrame.plotWidth * FINGERPRINT_HOURS));
          if (motion()) {
            state.targetRidge = hit.ridge;
            state.targetHour = state.glowTarget;
            state.targetStrength = 1;
            state.targetSkew = 1 + 0.08 * (0.5 - y / layout.height);
          }
        }
      }
      let moving = false;
      if (motion()) {
        const settle = (next: number, current: number) => { if (next !== current) moving = true; return next; };
        state.strength = settle(ease(state.strength, state.targetStrength, 0.16, 0.003), state.strength);
        state.skew = settle(ease(state.skew, state.targetSkew, 0.12, 0.0008), state.skew);
        // The lift's centre glides between dates, so neighbours respond gradually.
        state.focusRidge = settle(ease(state.focusRidge, state.targetRidge, 0.22, 0.01), state.focusRidge);
        state.glow = settle(ease(state.glow, state.glowTarget, 0.3, 0.01), state.glow);
        if (state.strength > 0) state.focus.forEach((focus, index) => {
          const distance = Math.abs(index - state.focusRidge);
          // Farther ridges follow later: horizontal motion propagates in depth.
          state.focus[index] = distance > 8 ? state.targetHour : settle(ease(focus, state.targetHour, 0.3 / (1 + 0.45 * distance), 0.02), focus);
        });
      } else {
        Object.assign(state, { strength: 0, targetStrength: 0, skew: 1, targetSkew: 1, glow: state.glowTarget });
      }
      render();
      if (moving) schedule();
    };
    const schedule = () => { if (!state.frameId && state.visible) state.frameId = requestAnimationFrame(step); };
    const release = () => {
      select(null);
      Object.assign(state, { pending: null, targetStrength: 0, targetSkew: 1, glowTarget: restGlow });
      schedule();
    };
    const stop = () => {
      if (state.frameId) cancelAnimationFrame(state.frameId);
      select(null);
      Object.assign(state, { frameId: 0, pending: null, strength: 0, targetStrength: 0, skew: 1, targetSkew: 1, focusRidge: state.targetRidge });
      render();
    };
    const toView = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      return rect.width && rect.height ? { x: (event.clientX - rect.left) / rect.width * layout.width, y: (event.clientY - rect.top) / rect.height * layout.height } : null;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // A pointer over the stage proves it is on screen, even if the observer's
      // first report predates layout (e.g. late CSS).
      state.visible = true;
      state.pending = toView(event);
      schedule();
    };
    const onEnter = (event: PointerEvent) => { if (event.pointerType !== "touch") state.inside = true; };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      state.inside = false;
      release();
    };
    const onDown = (event: PointerEvent) => {
      // Touch: a tap highlights the nearest date statically; scrolling is untouched.
      if (event.pointerType !== "touch") return;
      const point = toView(event);
      const hit = point && pickRidge(state.shownFrame, state.shownHeights, point.x, point.y, state.selection?.ridge ?? null);
      if (!hit) return;
      if (state.selection?.ridge === hit.ridge && state.selection.hour === hit.hour) { release(); return; }
      select(hit);
      state.glow = state.glowTarget = hit.hour + 0.5;
      state.visible = true;
      schedule();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { release(); return; }
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const move = moves[event.key];
      if (!move && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const base = state.selection ?? rest ?? { ridge: model.ridges.length - 1, hour: 12 };
      const next = event.key === "Home" ? { ...base, hour: 0 } : event.key === "End" ? { ...base, hour: FINGERPRINT_HOURS - 1 }
        : { ridge: Math.min(model.ridges.length - 1, Math.max(0, base.ridge + move[0])), hour: Math.min(FINGERPRINT_HOURS - 1, Math.max(0, base.hour + move[1])) };
      select(next);
      state.glowTarget = next.hour + 0.5;
      state.visible = true;
      schedule();
    };
    const onBlur = () => { if (!state.inside) release(); };

    stage.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("pointerdown", onDown, { passive: true });
    stage.addEventListener("keydown", onKey);
    stage.addEventListener("blur", onBlur);
    const syncMotion = () => { stage.dataset.motion = reduce.matches ? "reduced" : "full"; if (reduce.matches) stop(); };
    reduce.addEventListener("change", syncMotion);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
      stage.dataset.visible = String(entry.isIntersecting);
      if (!entry.isIntersecting) stop();
    });
    observer?.observe(stage);
    const onHidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onHidden);
    // Signals that pointer/keyboard enhancement is attached (tests, tooling).
    stage.dataset.interactive = "true";

    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("keydown", onKey);
      stage.removeEventListener("blur", onBlur);
      reduce.removeEventListener("change", syncMotion);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      if (state.frameId) cancelAnimationFrame(state.frameId);
      Object.values(live).forEach((node) => node.remove());
      ridgeNodes.forEach((node, index) => { node.classList.remove("is-active"); node.setAttribute("d", paths[index]); });
      svg.removeAttribute("data-engaged");
      readout.textContent = label;
    };
  }, [model, layout, frame, heights, paths, rest, accentRadius, uid, label, dateStyle]);

  const stops = <><stop offset="0" stopColor="#55a7ff" stopOpacity="0" /><stop offset="0.5" stopColor="#55a7ff" /><stop offset="1" stopColor="#55a7ff" stopOpacity="0" /></>;

  return (
    <figure className={`fp ${className}`} data-fingerprint="" data-ridges={model.ridges.length}>
      <div
        ref={stageRef}
        className="fp-stage"
        style={{ ["--fp-aspect" as string]: `${layout.width} / ${layout.height}` }}
        tabIndex={model.ridges.length ? 0 : undefined}
        role="group"
        aria-label={`${title}. Explore with arrow keys: up and down move between dates, left and right between UTC hours.`}
        aria-describedby={`${uid}-readout`}
        data-active-ridge=""
      >
        <svg ref={svgRef} viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" className={`fp-svg ${rise ? "fp-rise" : ""}`} role="img" aria-labelledby={`${uid}-title ${uid}-desc`}>
          <title id={`${uid}-title`}>{title}</title>
          <desc id={`${uid}-desc`}>{description}</desc>
          <defs>
            <linearGradient id={`${uid}-rest`} gradientUnits="userSpaceOnUse" x1={fixed(restCentre - accentRadius)} x2={fixed(restCentre + accentRadius)} y1="0" y2="0">{stops}</linearGradient>
            <linearGradient id={`${uid}-live`} data-live-gradient="" gradientUnits="userSpaceOnUse" x1="0" x2="1" y1="0" y2="0">{stops}</linearGradient>
          </defs>
          {model.ridges.map((ridge, index) => (
            <g key={ridge.date} data-group={index} className="fp-ridge-group" style={{ ["--i" as string]: index }}>
              <path
                data-ridge={index}
                data-status={ridge.status}
                d={paths[index]}
                className={`fp-${ridge.status}${index === rest?.ridge ? " is-rest" : ""}`}
                stroke={ridge.status === "observed" ? depthInk(index, model.ridges.length) : undefined}
              />
              {index === rest?.ridge && <>
                <path className="fp-accent-line fp-rest-hl" d={paths[index]} stroke={`url(#${uid}-rest)`} />
                <path data-stipple="" className="fp-stipple fp-rest-hl" d={localStipplePath(frame, frame.ridges[index], heights[index], rest.hour + 0.5)} stroke={`url(#${uid}-rest)`} />
              </>}
            </g>
          ))}
          {front && (
            <g aria-hidden="true" className="fp-axis">
              <path d={Array.from({ length: FINGERPRINT_HOURS + 1 }, (_, hour) => `M${fixed(hourX(frame, front, hour))},${fixed(front.baseline + 7)} v${hour % 6 ? 3 : 7}`).join(" ")} />
              {back && back !== front && <path className="fp-depth" d={`M${fixed(back.right + layout.tail + 8)},${fixed(back.baseline)} L${fixed(front.right + layout.tail + 8)},${fixed(front.baseline)}`} />}
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
        <p ref={readoutRef} id={`${uid}-readout`} className="fp-readout" aria-live="polite">{label}</p>
        {controls}
      </figcaption>

      {/* Equivalent data for assistive technology; sighted users explore by pointer or keyboard. */}
      <div className="sr-only">
        <p>{description}</p>
        <table>
          <caption>{title}: {measureLabels[model.measure]} per UTC date</caption>
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
    </figure>
  );
}
