/**
 * Activity fingerprint: one ridge per UTC date, x = UTC hour of day, amplitude =
 * one hourly measure, depth = consecutive dates (oldest at the back).
 *
 * Semantics are explicit and never inferred:
 * - "observed": an uploaded record with 24 UTC bins. Observed zero stays zero.
 * - "unavailable": an uploaded record whose optional hourly field is null.
 * - "missing": no record for that calendar date. Never zero-filled.
 * Values are scaled linearly against the largest observed bin in the window.
 * No smoothing, clipping or rebinning is applied to values; curves pass
 * exactly through bin centres with monotone interpolation (no overshoot).
 *
 * Geometry uses only IEEE-exact arithmetic (+ − × ÷ √) and fixed-precision
 * serialization, so server markup and hydration are byte-identical.
 */

export const FINGERPRINT_HOURS = 24;
export const DEFAULT_MAX_RIDGES = 30;
export type FingerprintMeasure = "activeMs" | "editCount" | "linesAdded" | "linesRemoved";
/** `hours: null` is an uploaded record without hourly data, not an observed zero. */
export type FingerprintInputDay = { date: string; hours: readonly number[] | null };
export type RidgeStatus = "observed" | "unavailable" | "missing";
export type FingerprintRidge = {
  date: string;
  /** 0 = Sunday, from the UTC calendar date. */
  weekday: number;
  status: RidgeStatus;
  values: readonly number[] | null;
  total: number | null;
  peakHour: number | null;
};
export type FingerprintModel = {
  from: string;
  to: string;
  measure: FingerprintMeasure;
  ridges: FingerprintRidge[];
  /** Largest observed hourly bin; 0 when every observed bin is zero or none exist. */
  maxValue: number;
  observedDays: number;
  unavailableDays: number;
  missingDays: number;
  zeroDays: number;
  /** Input dates older than the ridge cap, omitted from this rendering. */
  omittedDays: number;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function parseDate(date: string): number {
  const time = datePattern.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new Error(`Invalid fingerprint date: ${date}`);
  return time;
}
const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

export function buildFingerprint(days: readonly FingerprintInputDay[], options: { measure?: FingerprintMeasure; from?: string; to?: string; maxRidges?: number } = {}): FingerprintModel {
  const maxRidges = Math.max(1, Math.floor(options.maxRidges ?? DEFAULT_MAX_RIDGES));
  const byDate = new Map<string, readonly number[] | null>();
  for (const day of days) {
    parseDate(day.date);
    if (byDate.has(day.date)) throw new Error(`Duplicate fingerprint date: ${day.date}`);
    if (day.hours !== null && (day.hours.length !== FINGERPRINT_HOURS || day.hours.some(value => !Number.isFinite(value) || value < 0))) {
      throw new Error(`Fingerprint hours must be 24 finite non-negative bins: ${day.date}`);
    }
    byDate.set(day.date, day.hours);
  }
  const sorted = [...byDate.keys()].sort();
  const to = options.to ?? sorted.at(-1);
  const requestedFrom = options.from ?? sorted[0];
  if (!to || !requestedFrom) {
    return { from: "", to: "", measure: options.measure ?? "activeMs", ridges: [], maxValue: 0, observedDays: 0, unavailableDays: 0, missingDays: 0, zeroDays: 0, omittedDays: 0 };
  }
  const end = parseDate(to);
  let start = parseDate(requestedFrom);
  if (start > end) throw new Error("Fingerprint range starts after it ends");
  // Keep the most recent dates; older ones are counted, never merged in.
  const earliestShown = end - (maxRidges - 1) * DAY_MS;
  if (start < earliestShown) start = earliestShown;
  const from = isoDate(start);
  const omittedDays = sorted.filter(date => date < from).length;

  const ridges: FingerprintRidge[] = [];
  let maxValue = 0;
  for (let time = start; time <= end; time += DAY_MS) {
    const date = isoDate(time);
    const weekday = new Date(time).getUTCDay();
    if (!byDate.has(date)) { ridges.push({ date, weekday, status: "missing", values: null, total: null, peakHour: null }); continue; }
    const hours = byDate.get(date)!;
    if (hours === null) { ridges.push({ date, weekday, status: "unavailable", values: null, total: null, peakHour: null }); continue; }
    let total = 0, peakHour: number | null = null;
    hours.forEach((value, hour) => {
      total += value;
      if (value > 0 && (peakHour === null || value > hours[peakHour])) peakHour = hour;
      if (value > maxValue) maxValue = value;
    });
    ridges.push({ date, weekday, status: "observed", values: [...hours], total, peakHour });
  }
  const count = (status: RidgeStatus) => ridges.filter(ridge => ridge.status === status).length;
  return {
    from, to, measure: options.measure ?? "activeMs", ridges, maxValue,
    observedDays: count("observed"), unavailableDays: count("unavailable"), missingDays: count("missing"),
    zeroDays: ridges.filter(ridge => ridge.status === "observed" && ridge.total === 0).length, omittedDays,
  };
}

/** Owner-only private `hourlyUtc` rows. Never used for public profiles. */
export function fingerprintDaysFromHourlyRows(rows: readonly { date: string; hourlyUtc: null | Record<"activeMsByHour" | "editCountByHour" | "linesAddedByHour" | "linesRemovedByHour", readonly number[]> }[], measure: FingerprintMeasure = "activeMs"): FingerprintInputDay[] {
  const field = { activeMs: "activeMsByHour", editCount: "editCountByHour", linesAdded: "linesAddedByHour", linesRemoved: "linesRemovedByHour" } as const;
  return rows.map(row => ({ date: row.date, hours: row.hourlyUtc ? row.hourlyUtc[field[measure]] : null }));
}

export type FingerprintSummary = {
  total: number;
  busiestHour: number | null;
  busiestDay: FingerprintRidge | null;
  hourTotals: number[];
};
/** Derived only from observed ridges; unavailable/missing dates contribute nothing. */
export function summarizeFingerprint(model: FingerprintModel): FingerprintSummary {
  const hourTotals = Array<number>(FINGERPRINT_HOURS).fill(0);
  let busiestDay: FingerprintRidge | null = null;
  for (const ridge of model.ridges) {
    if (ridge.status !== "observed") continue;
    ridge.values!.forEach((value, hour) => { hourTotals[hour] += value; });
    if (ridge.total! > 0 && (!busiestDay || ridge.total! > busiestDay.total!)) busiestDay = ridge;
  }
  const total = hourTotals.reduce((sum, value) => sum + value, 0);
  let busiestHour: number | null = null;
  hourTotals.forEach((value, hour) => { if (value > 0 && (busiestHour === null || value > hourTotals[busiestHour])) busiestHour = hour; });
  return { total, busiestHour, busiestDay, hourTotals };
}

/* ------------------------------------------------------------------ geometry */

export type FingerprintLayout = {
  width: number; height: number;
  padLeft: number; padRight: number; padTop: number; padBottom: number;
  /** Horizontal offset between consecutive ridges (waterfall depth). */
  skew: number;
  /** Maximum ridge height; ridges may overlap the ones behind them. */
  amplitude: number;
  /** Flat baseline drawn beyond the 00:00 and 24:00 UTC boundaries. */
  tail: number;
};
export const heroLayout: FingerprintLayout = { width: 1000, height: 600, padLeft: 24, padRight: 24, padTop: 16, padBottom: 44, skew: 11, amplitude: 150, tail: 18 };
export const compactLayout: FingerprintLayout = { width: 640, height: 300, padLeft: 12, padRight: 12, padTop: 12, padBottom: 32, skew: 4, amplitude: 64, tail: 10 };
/** Static miniature for profile cards (about two weeks of ridges). */
export const cardLayout: FingerprintLayout = { width: 240, height: 88, padLeft: 3, padRight: 3, padTop: 2, padBottom: 3, skew: 4, amplitude: 30, tail: 3 };

export type RidgeFrame = { index: number; baseline: number; left: number; right: number };
export type FingerprintFrame = { layout: FingerprintLayout; plotWidth: number; gap: number; ridges: RidgeFrame[] };

/** Oldest ridge at the back (top, shifted right); newest at the front. */
export function fingerprintFrame(model: FingerprintModel, layout: FingerprintLayout, skewScale = 1): FingerprintFrame {
  const count = model.ridges.length;
  const depth = Math.max(0, count - 1);
  const plotWidth = layout.width - layout.padLeft - layout.padRight - 2 * layout.tail - depth * layout.skew;
  const firstBaseline = layout.padTop + layout.amplitude;
  const lastBaseline = layout.height - layout.padBottom;
  const gap = depth ? (lastBaseline - firstBaseline) / depth : 0;
  // A scaled skew (interaction only) stays centred on the resting footprint.
  const skew = layout.skew * skewScale, centre = (layout.skew - skew) * depth / 2;
  const ridges = model.ridges.map((_, index) => {
    const left = layout.padLeft + layout.tail + (depth - index) * skew + centre;
    return { index, baseline: count === 1 ? lastBaseline : firstBaseline + index * gap, left, right: left + plotWidth };
  });
  return { layout, plotWidth, gap, ridges };
}

export const hourX = (frame: FingerprintFrame, ridge: RidgeFrame, hour: number) => ridge.left + hour / FINGERPRINT_HOURS * frame.plotWidth;

// Depth shading, back → front. Integer channel mixing keeps SSR/hydration identical.
const BACK = [0x33, 0x32, 0x2c], FRONT = [0xd4, 0xd0, 0xc4];
export function depthInk(index: number, count: number) {
  const linear = count > 1 ? index / (count - 1) : 1;
  const t = linear * linear * 0.55 + linear * 0.45;
  return `#${BACK.map((channel, i) => Math.round(channel + (FRONT[i] - channel) * t).toString(16).padStart(2, "0")).join("")}`;
}
const fixed = (value: number) => Math.round(value * 100) / 100;

type Point = [number, number];
/** d3 curveMonotoneX (Steffen): passes through every point, never overshoots. */
function monotonePath(points: Point[]): string {
  const n = points.length;
  if (n < 2) return "";
  const sign = (value: number) => value < 0 ? -1 : 1;
  const slopes = points.map((_, i) => {
    if (i === 0 || i === n - 1) return NaN;
    const [x0, y0] = points[i - 1], [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const h0 = x1 - x0, h1 = x2 - x1, s0 = (y1 - y0) / h0, s1 = (y2 - y1) / h1, p = (s0 * h1 + s1 * h0) / (h0 + h1);
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  });
  const end = (i: number, inner: number) => {
    const [x0, y0] = points[i], [x1, y1] = points[i === 0 ? 1 : i - 1];
    const h = x1 - x0;
    return h ? (3 * (y1 - y0) / h - inner) / 2 : inner;
  };
  slopes[0] = n > 2 ? end(0, slopes[1]) : (points[1][1] - points[0][1]) / (points[1][0] - points[0][0]);
  slopes[n - 1] = n > 2 ? end(n - 1, slopes[n - 2]) : slopes[0];
  let d = "";
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    const dx = (x1 - x0) / 3;
    d += ` C${fixed(x0 + dx)},${fixed(y0 + dx * slopes[i])} ${fixed(x1 - dx)},${fixed(y1 - dx * slopes[i + 1])} ${fixed(x1)},${fixed(y1)}`;
  }
  return d;
}

/** Height (px) of each hour bin, optionally scaled by an interaction gain. */
export function ridgeHeights(ridge: FingerprintRidge, model: FingerprintModel, layout: FingerprintLayout, gain?: (hour: number) => number): number[] {
  if (ridge.status !== "observed" || model.maxValue <= 0) return Array<number>(FINGERPRINT_HOURS).fill(0);
  return ridge.values!.map((value, hour) => value / model.maxValue * layout.amplitude * (gain ? gain(hour) : 1));
}

/**
 * Open path: flat tail, day boundary at the baseline, a point at every bin
 * centre, back to the baseline, flat tail. Filling closes along the baseline,
 * so one element both occludes the ridges behind it and draws its line.
 */
export function ridgePath(frame: FingerprintFrame, ridgeFrame: RidgeFrame, heights: readonly number[]): string {
  const { baseline } = ridgeFrame;
  const points: Point[] = [[hourX(frame, ridgeFrame, 0), baseline]];
  heights.forEach((height, hour) => points.push([hourX(frame, ridgeFrame, hour + 0.5), baseline - height]));
  points.push([hourX(frame, ridgeFrame, FINGERPRINT_HOURS), baseline]);
  const tail = frame.layout.tail;
  return `M${fixed(ridgeFrame.left - tail)},${fixed(baseline)} L${fixed(points[0][0])},${fixed(baseline)}${monotonePath(points)} L${fixed(ridgeFrame.right + tail)},${fixed(baseline)}`;
}

/** Baseline only: used for unavailable (dotted) and observed-zero ridges. */
export function baselinePath(frame: FingerprintFrame, ridgeFrame: RidgeFrame): string {
  return `M${fixed(ridgeFrame.left - frame.layout.tail)},${fixed(ridgeFrame.baseline)} L${fixed(ridgeFrame.right + frame.layout.tail)},${fixed(ridgeFrame.baseline)}`;
}

/**
 * Stipple under one ridge: a pair of dot columns at each bin centre, each
 * exactly that bin's height quantized to `step` px (top dot kept just under the
 * line). Zero-length round-capped segments render as dots in one path element.
 */
export function stipplePath(frame: FingerprintFrame, ridgeFrame: RidgeFrame, heights: readonly number[], step = 5): string {
  let d = "";
  heights.forEach((height, hour) => {
    const centre = hourX(frame, ridgeFrame, hour + 0.5), offset = frame.plotWidth / FINGERPRINT_HOURS * 0.14;
    for (const x of [fixed(centre - offset), fixed(centre + offset)]) {
      for (let y = step; y <= height - 2; y += step) d += `M${x},${fixed(ridgeFrame.baseline - y)}h0`;
    }
  });
  return d;
}

/** Stipple only near one hour, so the accent stays local to the pointer. */
export function localStipplePath(frame: FingerprintFrame, ridgeFrame: RidgeFrame, heights: readonly number[], centreHour: number, radius = 3.5, step = 5): string {
  return stipplePath(frame, ridgeFrame, heights.map((height, hour) => Math.abs(hour + 0.5 - centreHour) <= radius ? height : 0), step);
}

/** A bin centre on the drawn curve (monotone paths pass exactly through it). */
export function binPoint(frame: FingerprintFrame, ridgeFrame: RidgeFrame, heights: readonly number[], hour: number) {
  return { x: fixed(hourX(frame, ridgeFrame, hour + 0.5)), y: fixed(ridgeFrame.baseline - heights[hour]) };
}

/** Point at the curve for a fractional hour, interpolating bin centres linearly. */
export function heightAtHour(heights: readonly number[], hour: number): number {
  const position = hour - 0.5;
  if (position <= 0) return heights[0] * Math.max(0, hour / 0.5);
  if (position >= FINGERPRINT_HOURS - 1) return heights[FINGERPRINT_HOURS - 1] * Math.max(0, (FINGERPRINT_HOURS - hour) / 0.5);
  const lower = Math.floor(position), fraction = position - lower;
  return heights[lower] * (1 - fraction) + heights[lower + 1] * fraction;
}

export type RidgeHit = { ridge: number; hour: number };
const hourOn = (frame: FingerprintFrame, ridgeFrame: RidgeFrame, x: number) => (x - ridgeFrame.left) / frame.plotWidth * FINGERPRINT_HOURS;
const binAt = (hour: number) => Math.min(FINGERPRINT_HOURS - 1, Math.max(0, Math.floor(hour)));

/**
 * The ridge actually visible at a point: the frontmost ridge whose filled
 * silhouette (between its line and baseline) contains it. `heights` are the
 * currently displayed heights, so hit-testing follows any deformation.
 */
export function visibleRidgeAt(frame: FingerprintFrame, heights: readonly (readonly number[])[], x: number, y: number): RidgeHit | null {
  const tail = frame.layout.tail / frame.plotWidth * FINGERPRINT_HOURS;
  for (let index = frame.ridges.length - 1; index >= 0; index--) {
    const ridgeFrame = frame.ridges[index], hour = hourOn(frame, ridgeFrame, x);
    if (hour < -tail || hour > FINGERPRINT_HOURS + tail) continue;
    const line = ridgeFrame.baseline - heightAtHour(heights[index], Math.min(FINGERPRINT_HOURS, Math.max(0, hour)));
    if (y >= line - 0.75 && y <= ridgeFrame.baseline + 0.75) return { ridge: index, hour: binAt(hour) };
  }
  return null;
}

/** Nearest drawn line (for gaps between flat baselines); front ridges win ties. */
export function nearestLine(frame: FingerprintFrame, heights: readonly (readonly number[])[], x: number, y: number): RidgeHit | null {
  let best: RidgeHit | null = null, bestDistance = Infinity;
  for (const ridgeFrame of frame.ridges) {
    const hour = hourOn(frame, ridgeFrame, x);
    if (hour < -0.5 || hour > FINGERPRINT_HOURS + 0.5) continue;
    const distance = Math.abs(y - (ridgeFrame.baseline - heightAtHour(heights[ridgeFrame.index], Math.min(FINGERPRINT_HOURS, Math.max(0, hour)))));
    if (distance <= bestDistance) { bestDistance = distance; best = { ridge: ridgeFrame.index, hour: binAt(hour) }; }
  }
  return best;
}

/**
 * Pointer selection with hysteresis. The current ridge is kept while it is
 * still the visible surface within ±`margin` of the pointer, so small or fast
 * movements near a boundary never flicker between neighbours.
 */
export function pickRidge(frame: FingerprintFrame, heights: readonly (readonly number[])[], x: number, y: number, current: number | null, margin = frame.gap * 0.42): RidgeHit | null {
  const at = (offset: number) => visibleRidgeAt(frame, heights, x, y + offset) ?? nearestLine(frame, heights, x, y + offset);
  const here = at(0);
  if (!here || current === null || here.ridge === current || !frame.ridges[current]) return here;
  if (at(-margin)?.ridge === current || at(margin)?.ridge === current) return { ridge: current, hour: binAt(hourOn(frame, frame.ridges[current], x)) };
  return here;
}

/** Nearest line using resting geometry (kept for simple callers). */
export function nearestRidge(model: FingerprintModel, frame: FingerprintFrame, x: number, y: number): RidgeHit | null {
  return nearestLine(frame, model.ridges.map((ridge) => ridgeHeights(ridge, model, frame.layout)), x, y);
}

/* ------------------------------------------------------------- labelling */

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const weekdayName = (ridge: FingerprintRidge) => weekdays[ridge.weekday];
/** Deterministic UTC calendar label; never viewer-local. */
export function formatFingerprintDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${months[month - 1]} ${day}`;
}
export const formatUtcHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
export const formatUtcHourRange = (hour: number) => `${formatUtcHour(hour)}–${hour === 23 ? "24:00" : formatUtcHour(hour + 1)} UTC`;

/* ------------------------------------------------- representative dataset */

// Integer-only generator: identical on every JavaScript engine. Minutes per
// UTC hour for four day archetypes of a Europe-based developer.
const templates = {
  focus: [0, 0, 0, 0, 0, 0, 0, 3, 20, 44, 52, 48, 18, 26, 46, 55, 50, 34, 12, 4, 8, 12, 6, 0],
  late: [9, 3, 0, 0, 0, 0, 0, 0, 0, 4, 12, 20, 14, 10, 16, 24, 20, 12, 18, 36, 48, 54, 42, 24],
  short: [0, 0, 0, 0, 0, 0, 0, 6, 24, 40, 46, 30, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  weekend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 16, 24, 14, 6, 0, 0, 0, 8, 18, 12, 2, 0, 0],
} as const;
type Plan = keyof typeof templates | "missing" | "zero";
// 30 consecutive UTC dates starting Monday 2026-08-31.
const plan: Plan[] = [
  "focus", "focus", "late", "focus", "short", "weekend", "missing",
  "focus", "focus", "focus", "late", "focus", "zero", "weekend",
  "focus", "late", "focus", "focus", "short", "weekend", "missing",
  "focus", "focus", "late", "focus", "focus", "weekend", "weekend",
  "focus", "focus",
];
export const REPRESENTATIVE_FROM = "2026-08-31";
export const REPRESENTATIVE_TO = "2026-09-29";

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/**
 * Integer-only synthetic days from minutes-per-UTC-hour templates. Used only
 * for clearly labelled example data; `scale` is a percentage per day.
 */
export function synthesizeFingerprintDays(from: string, seed: number, days: readonly (readonly number[] | "missing" | "zero")[], scale: (index: number, random: () => number) => number = (_, random) => 72 + random() % 38): FingerprintInputDay[] {
  const next = mulberry32(seed);
  const start = parseDate(from);
  return days.flatMap((template, index): FingerprintInputDay[] => {
    const date = isoDate(start + index * DAY_MS);
    if (template === "missing") return [];
    if (template === "zero") return [{ date, hours: Array<number>(FINGERPRINT_HOURS).fill(0) }];
    const percent = scale(index, next);
    const hours = template.map((minutes) => {
      const noise = next();
      if (minutes === 0) return 0;
      const value = Math.min(59, Math.max(0, Math.floor(minutes * percent / 100) + (noise % 7) - 3));
      return value * 60_000 + (value ? (noise >>> 8) % 60 * 1000 : 0);
    });
    return [{ date, hours }];
  });
}

/** Clearly representative example data for anonymous/marketing presentation. */
export function representativeFingerprintDays(): FingerprintInputDay[] {
  return synthesizeFingerprintDays(REPRESENTATIVE_FROM, 0x5eed_9d, plan.map((kind) => kind === "missing" || kind === "zero" ? kind : templates[kind]), (index, random) => index === 9 ? 118 : 72 + random() % 38);
}
export function representativeFingerprint(): FingerprintModel {
  return buildFingerprint(representativeFingerprintDays(), { from: REPRESENTATIVE_FROM, to: REPRESENTATIVE_TO });
}
