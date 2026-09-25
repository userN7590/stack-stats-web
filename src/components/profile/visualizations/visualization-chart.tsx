import type { ReactNode } from "react";

import { rendererDefinitions, resolveAppearance, type VisualizationConfig, type VisualizationDataset } from "@/lib/visualization";

const ink = "#C8C4B9";
const grid = "#3B3931";
// Trig implementations can differ by a final bit between Node and browsers.
// Stable sub-pixel serialization keeps server SVG and hydration identical.
const coordinate = (value: number) => Number(value.toFixed(4));
const point = (radius: number, angle: number) => [coordinate(220 + radius * Math.cos(angle)), coordinate(150 + radius * Math.sin(angle))];

/** Two arcs also cover the one-category/full-circle case without a degenerate path. */
export function annularSector(inner: number, outer: number, start: number, end: number): string {
  const middle = (start + end) / 2;
  const [a, b, c] = [start, middle, end].map((angle) => point(outer, angle));
  const [d, e, f] = [end, middle, start].map((angle) => point(inner, angle));
  outer = coordinate(outer);
  inner = coordinate(inner);
  return `M ${a} A ${outer} ${outer} 0 0 1 ${b} A ${outer} ${outer} 0 0 1 ${c} L ${d} A ${inner} ${inner} 0 0 0 ${e} A ${inner} ${inner} 0 0 0 ${f} Z`;
}

export function polarRadius(value: number, maximum: number): number {
  // Area, not radius, encodes value, including the inner hole.
  return Math.sqrt(26 ** 2 + (126 ** 2 - 26 ** 2) * value / maximum);
}

export function VisualizationChart({ dataset, config, thumbnail = false }: {
  dataset: VisualizationDataset;
  config: VisualizationConfig;
  thumbnail?: boolean;
}) {
  const appearance = resolveAppearance(config.appearance);
  const rows = dataset.rows;
  if (!rows.length) return <p className="py-8 text-sm text-[#969287]">{dataset.emptyMessage}</p>;
  const values = rows.map((row) => row.value);
  const format = (value: number) => dataset.unit === "%" ? `${value.toFixed(1)}%` : value.toLocaleString("en-US");
  const description = rendererDefinitions[config.renderer].description;
  let graphic: ReactNode;
  let caption = description;

  if (config.renderer === "bars" || config.renderer === "dots") {
    const step = 235 / rows.length;
    graphic = <>
      {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={155 + tick * 2.5} x2={155 + tick * 2.5} y1="18" y2="263" stroke={grid} /><text x={155 + tick * 2.5} y="288" fill={ink} textAnchor="middle" fontSize="12">{tick}%</text></g>)}
      {rows.map((row, index) => {
        const y = 25 + step * (index + 0.5);
        return <g key={row.id}><title>{`${row.label}: ${format(row.value)}`}</title>
          <text x="4" y={y + 4} fill={ink} fontSize="13">{row.label.length > 18 ? `${row.label.slice(0, 17)}…` : row.label}</text>
          {config.renderer === "bars" ? <rect x="155" y={y - 8} width={Math.max(0, row.value * 2.5)} height="16" rx="2" fill={appearance.colors[index]} /> : <><line x1="155" x2={155 + row.value * 2.5} y1={y} y2={y} stroke={appearance.colors[index]} strokeOpacity="0.4" /><circle cx={155 + row.value * 2.5} cy={y} r="5" fill={appearance.colors[index]} /></>}
        </g>;
      })}
    </>;
  } else if (config.renderer === "radial_bars") {
    caption = "A full turn is 100%. Compare arc angles; ring radius is decorative, not a second measure.";
    const thickness = Math.min(16, 90 / rows.length);
    graphic = <>
      {rows.map((row, index) => {
        const r = 128 - index * (96 / rows.length);
        const circumference = 2 * Math.PI * r;
        return <g key={row.id}><title>{`${row.label}: ${format(row.value)}`}</title><circle cx="220" cy="150" r={r} fill="none" stroke={grid} strokeWidth={thickness} /><circle cx="220" cy="150" r={r} fill="none" stroke={appearance.colors[index]} strokeWidth={thickness} strokeDasharray={`${circumference * row.value / 100} ${circumference}`} transform="rotate(-90 220 150)" /></g>;
      })}
      <text x="220" y="148" fill={ink} textAnchor="middle" fontSize="10" letterSpacing="2">ACTIVITY</text>
      <text x="220" y="164" fill={ink} textAnchor="middle" fontSize="10">0 → 100%</text>
    </>;
  } else if (config.renderer === "polar_area") {
    caption = "Equal-angle petals. Colored area is proportional to activity share; radial grid lines mark equal area steps.";
    const max = Math.max(...values);
    graphic = <>
      {[0.25, 0.5, 0.75, 1].map((fraction) => <circle key={fraction} cx="220" cy="150" r={polarRadius(max * fraction, max)} fill="none" stroke={grid} strokeDasharray="2 5" />)}
      {rows.map((row, index) => {
        const start = index * Math.PI * 2 / rows.length - Math.PI / 2;
        const end = (index + 1) * Math.PI * 2 / rows.length - Math.PI / 2;
        return <path key={row.id} d={annularSector(26, polarRadius(row.value, max), start + 0.025, end - 0.025)} fill={appearance.colors[index]}><title>{`${row.label}: ${format(row.value)}`}</title></path>;
      })}
      <circle cx="220" cy="150" r="17" fill="none" stroke={ink} strokeOpacity="0.5" />
      <text x="220" y="154" fill={ink} fontSize="10" textAnchor="middle">S²</text>
    </>;
  } else if (config.renderer === "donut") {
    graphic = <>
      {rows.map((row, index) => {
        const start = -Math.PI / 2 + rows.slice(0, index).reduce((sum, previous) => sum + previous.value, 0) / 100 * Math.PI * 2;
        const angle = start + row.value / 100 * Math.PI * 2;
        return <path key={row.id} d={annularSector(79, 128, start, angle)} fill={appearance.colors[index]} stroke="#11110D" strokeWidth="1"><title>{`${row.label}: ${format(row.value)}`}</title></path>;
      })}
      <text x="220" y="147" fill={ink} textAnchor="middle" fontSize="15" letterSpacing="2">LANGUAGE</text>
      <text x="220" y="168" fill={ink} textAnchor="middle" fontSize="15" letterSpacing="2">ACTIVITY</text>
    </>;
  } else {
    const added = rows.find((row) => row.id === "added")?.value ?? 0;
    const removed = rows.find((row) => row.id === "removed")?.value ?? 0;
    const net = added + removed;
    const low = Math.min(0, net), high = Math.max(added, 0);
    const y = (value: number) => 240 - (value - low) / (high - low || 1) * 180;
    const steps = [
      { label: "Added", from: 0, to: added, value: added, color: appearance.positive },
      { label: "Removed", from: added, to: net, value: removed, color: appearance.negative },
      { label: "Edit balance", from: 0, to: net, value: net, color: net >= 0 ? appearance.positive : appearance.negative },
    ];
    caption = "Start at zero, add lines, subtract removals. The final column is the signed edit balance, not repository growth.";
    graphic = <>
      <line x1="24" x2="416" y1={y(0)} y2={y(0)} stroke={ink} strokeOpacity="0.7" />
      <text x="10" y={y(0) + 4} fontSize="12" fill={ink}>0</text>
      {steps.map((step, index) => {
        const x = 47 + index * 136;
        return <g key={step.label}><title>{`${step.label}: ${format(step.value)} lines`}</title>
          <rect x={x} y={Math.min(y(step.from), y(step.to))} width="74" height={Math.abs(y(step.from) - y(step.to))} fill={step.color} rx="2" />
          {index < 2 && <line x1={x + 74} x2={x + 136} y1={y(step.to)} y2={y(step.to)} stroke={ink} strokeDasharray="3 4" />}
          <text x={x + 37} y="30" textAnchor="middle" fontSize="15" fill={ink}>{step.value > 0 ? "+" : ""}{format(step.value)}</text>
          <text x={x + 37} y="280" textAnchor="middle" fontSize="13" fill={ink}>{step.label}</text>
        </g>;
      })}
    </>;
  }

  return <figure className="min-w-0">
    <svg viewBox="0 0 440 300" className={`mx-auto block w-full max-w-[600px] ${thumbnail ? "h-24" : ""}`} role="img" aria-label={`${rendererDefinitions[config.renderer].label}: ${dataset.label}. ${caption}`}><title>{dataset.label}</title>{graphic}</svg>
    {!thumbnail && <figcaption className="mt-2 text-xs leading-5 text-[#aaa69a]">{caption}</figcaption>}
  </figure>;
}
