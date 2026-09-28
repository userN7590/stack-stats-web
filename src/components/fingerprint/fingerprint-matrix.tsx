import type { ReactNode } from "react";

import { FINGERPRINT_HOURS, formatUtcHourRange, summarizeFingerprint, weekdayName, type FingerprintModel } from "@/lib/activity-fingerprint";

/**
 * The fingerprint resolved into a readable chart: rows are UTC dates, columns
 * are UTC hours, intensity is the same hourly measure. One path per level
 * keeps DOM small. Levels are equal fifths of the largest observed bin.
 */
export const matrixGeometry = { label: 64, cell: 24, row: 11, top: 22, levels: 5 };
const ramp = ["#1b2836", "#1f3a55", "#2a5680", "#3b78b4", "#55a7ff"];
const fixed = (value: number) => Math.round(value * 100) / 100;

export function matrixLevel(value: number, max: number) {
  return value <= 0 || max <= 0 ? 0 : Math.min(matrixGeometry.levels, Math.ceil(value / max * matrixGeometry.levels));
}

export function FingerprintMatrix({ model, title, dateStyle = "calendar", overlay }: {
  model: FingerprintModel;
  title: string;
  dateStyle?: "calendar" | "relative";
  /** Decorative annotation layer positioned over the chart. */
  overlay?: ReactNode;
}) {
  const { label, cell, row, top } = matrixGeometry;
  const width = label + FINGERPRINT_HOURS * cell, height = top + model.ridges.length * row + 4;
  const levels = Array.from({ length: matrixGeometry.levels }, () => "");
  let zeros = "", unavailable = "";
  model.ridges.forEach((ridge, index) => {
    const y = top + index * row;
    if (ridge.status === "unavailable") unavailable += `M${label},${fixed(y + row / 2)} H${width}`;
    ridge.values?.forEach((value, hour) => {
      const level = matrixLevel(value, model.maxValue);
      const x = label + hour * cell;
      if (level) levels[level - 1] += `M${x + 1},${y + 1}h${cell - 2}v${row - 2}h${-(cell - 2)}z`;
      else zeros += `M${x + cell / 2 - 1},${fixed(y + row / 2)}h2`;
    });
  });
  const summary = summarizeFingerprint(model);
  return (
    <figure className="fp-matrix-figure relative m-0 min-w-0">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img" aria-label={`${title}. ${model.observedDays} dates with hourly observations${model.missingDays ? `, ${model.missingDays} without a record` : ""}${model.unavailableDays ? `, ${model.unavailableDays} without hourly data` : ""}. ${summary.busiestHour === null ? "No activity observed." : `Busiest hour overall ${formatUtcHourRange(summary.busiestHour)}.`}`}>
          {[0, 6, 12, 18].map((hour) => (
            <text key={hour} x={label + hour * cell + 1} y={12} className="fp-matrix-text">{String(hour).padStart(2, "0")}</text>
          ))}
          <text x={width} y={12} textAnchor="end" className="fp-matrix-text fp-matrix-utc">UTC</text>
          {model.ridges.map((ridge, index) => index % 7 === 0 && (
            <text key={ridge.date} x={0} y={top + index * row + row - 2} className="fp-matrix-text">
              {`${weekdayName(ridge).slice(0, 3)} ${dateStyle === "relative" ? String(index + 1).padStart(2, "0") : ridge.date.slice(5)}`}
            </text>
          ))}
          {model.ridges.map((ridge, index) => ridge.status === "missing" && (
            <text key={ridge.date} x={label + 4} y={top + index * row + row - 2} className="fp-matrix-text fp-matrix-missing">no record</text>
          ))}
          <path d={zeros} className="fp-matrix-zero" />
          <path d={unavailable} className="fp-matrix-unavailable" />
          {levels.map((d, level) => d && <path key={level} d={d} fill={ramp[level]} />)}
        </svg>
        {overlay}
      </div>
    </figure>
  );
}
