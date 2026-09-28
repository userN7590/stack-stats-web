import type { ReactNode } from "react";
import { VisualizationChart } from "@/components/profile/visualizations/visualization-chart";
import { contentRenderers, datasetPoints, formatMetricValue, measureLabels, publicMetricState, type ContentModule, type DatasetConfig, type DataPoint } from "@/lib/profile-content";
import { metricRegistry, type PublicMetricId } from "@/lib/metric-registry";
import { formatPercentage } from "@/lib/format";
import { resolveAppearance, type RendererId } from "@/lib/visualization";
import type { PublicProfile } from "@/lib/types";

const muted = "text-xs leading-6 text-[#aaa69a]";
const heading = "[font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]";
const external = "inline-flex min-h-11 items-center gap-2 break-words text-sm text-[#c8c4b9] underline decoration-[#444239] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]";

function Metric({ profile, id, style = "label", large = false }: { profile: PublicProfile; id: PublicMetricId | null; style?: "number" | "label" | "context"; large?: boolean }) {
  if (!id) return <div className="min-h-24"><p className={muted}>No stat selected</p><span aria-hidden="true" className="mt-3 block text-2xl text-[#aaa69a]">—</span></div>;
  const definition = metricRegistry[id];
  const state = publicMetricState(profile, id);
  return <div data-metric={id} data-availability={state.status}>
    <p className={`break-words font-mono tracking-tight text-[#edeae0] ${large && state.status === "ready" ? "text-4xl sm:text-5xl" : "text-xl sm:text-2xl"}`}>
      {state.status === "ready" ? formatMetricValue(state.metric!.value!, definition.unit) : state.message}
    </p>
    <p className={style === "number" ? "sr-only" : "mt-3 font-mono text-xs leading-5 text-[#aaa69a]"}>{definition.label}</p>
    {style === "context" && <p className={`mt-4 max-w-lg ${muted}`}>{definition.description}</p>}
    {state.status === "unavailable" && <p className={`mt-2 ${muted}`}>{definition.emptyState}</p>}
  </div>;
}

export function ProfileContent({ profile, module }: { profile: PublicProfile; module: ContentModule }) {
  if (module.type === "single_stat") return <>
    <Metric profile={profile} id={module.metric} style={module.style} large />
    {module.metric && <ObservationNote profile={profile} id={module.metric} />}
  </>;
  if (module.type === "stat_grid") return <>
    <h2 className={`${heading} mb-7`}>Activity at a glance</h2>
    <div className="profile-stat-grid" data-columns={module.columns}>
      {module.cells.map((id, index) => <article key={index} className="min-w-0 border-b border-r border-[#2b2a24] p-4 sm:p-5"><Metric profile={profile} id={id} /></article>)}
    </div>
    <p className={`mt-4 ${muted}`}>Published observations · Last 30 days. Missing history is not measured zero.</p>
  </>;
  if (module.type === "dataset") return module.config ? <DatasetSection profile={profile} config={module.config} /> : <><h2 className={heading}>Activity data</h2><p className={`mt-4 ${muted}`}>No dataset selected.</p></>;
  if (module.type === "document") return <>
    <p className={`mb-3 font-mono ${muted}`}>Document / PDF · External link</p>
    <h2 className={heading}>{module.title}</h2>
    {module.url ? <a className={`${external} mt-5`} href={module.url} target="_blank" rel="noopener noreferrer">Open document <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a> : <p className={`mt-4 ${muted}`}>No document link added.</p>}
  </>;
  return <><h2 className={heading}>Links</h2><ul className="mt-5 divide-y divide-[#2b2a24]">{module.links.map((link, index) => <li key={index}><a className={`${external} py-2`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a></li>)}</ul>{!module.links.length && <p className={muted}>No links added.</p>}</>;
}

function ObservationNote({ profile, id }: { profile: PublicProfile; id: PublicMetricId }) {
  const state = publicMetricState(profile, id);
  const definition = metricRegistry[id];
  return <div className={`mt-5 ${muted}`}>
    {state.status === "ready" && <p>Automatically tracked by Stack Stats · Last 30 days · {state.message}</p>}
    <details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]">About this data</summary>
      <p>{definition.description}</p><p>Date basis: {definition.dateBasis === "UTC" ? "UTC" : "Recorded-local dates"}.</p>
      {definition.caveats.map(note => <p key={note}>{note}</p>)}
    </details>
  </div>;
}

function DatasetSection({ profile, config }: { profile: PublicProfile; config: DatasetConfig }) {
  const state = publicMetricState(profile, config.metric);
  const definition = metricRegistry[config.metric];
  const appearance = resolveAppearance(config.appearance);
  const sourcePoints = datasetPoints(profile, config);
  const shares = config.metric === "languages.activity";
  const points = [...sourcePoints];
  if (shares && config.renderer !== "list" && points.length > 8) {
    const remainder = points.splice(7);
    points.push({ id: "other-shares", label: "Other shares", value: remainder.reduce((sum, row) => sum + row.value, 0) });
  }
  const unit = shares ? "percent" : config.metric === "sessions.histogram" ? "count" : config.measure === "activeMs" ? "milliseconds" : "count";
  const format = (value: number) => unit === "percent" ? formatPercentage(value) : formatMetricValue(value, unit);
  let graphic: ReactNode = null;
  if (state.status !== "ready") graphic = <p className={`py-8 ${muted}`}>{state.message}. {state.status === "unavailable" ? definition.emptyState : "The owner has not published this data."}</p>;
  else if (!points.length) graphic = <p className={`py-8 ${muted}`}>{shares ? "No measured language activity for this measure." : "No uploaded observations in this period."}</p>;
  else if (shares && config.renderer !== "list") graphic = <VisualizationChart dataset={{ id: "language_share", kind: "share", label: definition.label, unit: "%", rows: points, sourceLabel: "Automatically tracked by Stack Stats", note: "", emptyMessage: "No measured activity." }} config={{ version: 1, dataset: "language_share", renderer: config.renderer as RendererId, appearance: config.appearance }} />;
  else if (config.renderer !== "list") graphic = <ActivityGraphic points={points} config={config} format={format} color={appearance.colors[0]} />;
  return <div data-dataset={config.dataset} data-renderer={config.renderer}>
    <h2 className={heading}>{definition.label}</h2>
    <p className={`mt-3 font-mono ${muted}`}>{contentRenderers[config.renderer].label} · {config.metric === "sessions.histogram" ? "Completed-session active duration" : measureLabels[config.measure]}</p>
    <div className="mt-6">{graphic}</div>
    {!!points.length && <details open={config.renderer === "list"} className="mt-4">
      <summary className={`min-h-11 cursor-pointer py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] ${muted}`}>View values{points.length < sourcePoints.length ? " (includes grouped shares)" : ""}</summary>
      <table className="w-full table-fixed border-collapse text-left font-mono text-xs"><caption className="sr-only">{definition.label}: {config.metric === "sessions.histogram" ? "sessions per duration bucket" : measureLabels[config.measure]}</caption>
        <thead><tr className="border-b border-[#2b2a24]"><th scope="col" className="py-3 font-normal text-[#aaa69a]">{shares ? "Language" : config.metric === "sessions.histogram" ? "Active duration" : config.metric === "schedule.daily" ? "Recorded-local date" : "UTC hour"}</th><th scope="col" className="text-right font-normal text-[#aaa69a]">{shares ? "Share" : config.metric === "sessions.histogram" ? "Sessions" : measureLabels[config.measure]}</th></tr></thead>
        <tbody>{points.map((row, index) => <tr key={row.id} className="border-b border-[#2b2a24]"><th scope="row" className="break-words py-3 pr-2 font-normal text-[#c8c4b9]">{shares && <span aria-hidden="true" className="mr-2 inline-block size-2" style={{ backgroundColor: appearance.colors[index % appearance.colors.length] }} />}{row.label}</th><td className="break-words py-3 text-right tabular-nums">{format(row.value)}</td></tr>)}</tbody>
      </table>
    </details>}
    <ObservationNote profile={profile} id={config.metric} />
  </div>;
}

function ActivityGraphic({ points, config, format, color }: { points: DataPoint[]; config: DatasetConfig; format: (value: number) => string; color: string }) {
  const maximum = Math.max(0, ...points.map(point => point.value));
  if (config.renderer === "heatmap") return <figure>
    <div className="grid grid-cols-6 gap-1" role="img" aria-label="UTC hour-of-day activity, summed across uploaded UTC dates. Values are available below.">
      {points.map(point => <div key={point.id} className="relative flex aspect-square min-w-0 items-center justify-center border border-[#3b3931] font-mono text-xs"><span aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: color, opacity: maximum ? point.value / maximum * 0.65 : 0 }} /><span className="relative text-[#edeae0]">{point.label.slice(0, 2)}</span></div>)}
    </div><figcaption className={`mt-4 ${muted}`}>00–23 UTC · Brighter cells show more activity. {maximum === 0 ? "All observed bins are zero." : `Peak hour: ${format(maximum)}.`} These bins combine uploaded dates; they are not a daily schedule.</figcaption>
  </figure>;
  const daily = config.metric === "schedule.daily";
  const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const axisLabel = (value: number) => config.metric !== "sessions.histogram" && config.measure === "activeMs"
    ? value >= 3_600_000 ? `${compactNumber.format(value / 3_600_000)}h` : format(value)
    : compactNumber.format(value);
  const from = daily ? Date.parse(points[0].id) : 0;
  const to = daily ? Date.parse(points.at(-1)!.id) : points.length - 1;
  const slots = daily ? (to - from) / 86_400_000 + 1 : points.length;
  const x = (index: number) => config.renderer === "line"
    ? points.length === 1 ? 270 : 85 + (Date.parse(points[index].id) - from) / (to - from || 1) * 370
    : 85 + ((daily ? (Date.parse(points[index].id) - from) / 86_400_000 : index) + 0.5) / slots * 370;
  const y = (value: number) => 210 - value / (maximum || 1) * 165;
  return <figure><svg viewBox="0 0 510 265" role="img" aria-label={`${contentRenderers[config.renderer].label}: ${metricRegistry[config.metric].label}. Exact values available below.`} className="block w-full">
    {[0, 0.5, 1].map(fraction => <g key={fraction}><line x1="85" x2="475" y1={y(maximum * fraction)} y2={y(maximum * fraction)} stroke="#2b2a24" /><text x="78" y={y(maximum * fraction) + 4} textAnchor="end" fill="#aaa69a" fontSize="14">{axisLabel(maximum * fraction)}</text></g>)}
    {points.map((point, index) => <g key={point.id}><title>{`${point.label}: ${format(point.value)}`}</title>
      {config.renderer === "line" ? <>
        {index > 0 && Date.parse(point.id) - Date.parse(points[index - 1].id) === 86_400_000 && <line x1={x(index - 1)} x2={x(index)} y1={y(points[index - 1].value)} y2={y(point.value)} stroke={color} strokeWidth="2" />}
        <circle cx={x(index)} cy={y(point.value)} r="3" fill={color} />
      </> : <rect x={x(index) - Math.min(25, 170 / slots)} y={y(point.value)} width={Math.min(50, 340 / slots)} height={210 - y(point.value)} fill={color} />}
      {(!daily || index === 0 || index === points.length - 1) && <text x={x(index)} y={235} textAnchor="middle" fill="#c8c4b9" fontSize="14">{daily ? point.label.slice(5) : ["0", ">0", "1m", "5m", "15m", "30m", "1h", "2h", "4h+"][index]}</text>}
    </g>)}
  </svg><figcaption className={muted}>{daily ? "Recorded-local dates. Gaps are missing observations; lines connect only consecutive uploaded dates." : "Sessions per active-duration bucket. Labels mark bucket starts; full ranges appear in the values table. Buckets have unequal time ranges; bar height shows count, not density."}{maximum === 0 ? " All observed values are zero." : ""}</figcaption></figure>;
}
