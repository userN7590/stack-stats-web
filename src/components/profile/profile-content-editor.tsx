"use client";

import Link from "next/link";
import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { compatibleContentRenderers, contentRenderers, datasetMetricIds, defaultDatasetConfig, externalUrlSchema, measureLabels, measures, publicMetricState, scalarMetricIds, type ContentModule, type DatasetMetric, type Measure } from "@/lib/profile-content";
import { metricRegistry, type PublicMetricId } from "@/lib/metric-registry";
import { appearanceWarnings, palettes, resolveAppearance, type ChartAppearance } from "@/lib/visualization";
import type { PublicProfile } from "@/lib/types";

export const contentButton = "min-h-11 rounded-[3px] border border-[#444239] px-3 py-2 text-xs text-[#c8c4b9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:opacity-40";
const hint = "text-xs leading-6 text-[#aaa69a]";
function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return <div className="min-w-0 space-y-2 text-xs text-[#c8c4b9]"><label htmlFor={id} className="block">{label}</label>{cloneElement(children, { id })}</div>;
}
export function MetricSelect({ profile, value, onChange, label }: { profile: PublicProfile; value: PublicMetricId | null; onChange: (id: PublicMetricId | null) => void; label: string }) {
  return <Field label={label}><select className="profile-field" value={value ?? ""} onChange={event => onChange(event.target.value as PublicMetricId || null)}>
    <option value="">Empty cell</option>
    {scalarMetricIds.map(id => {
      const state = publicMetricState(profile, id);
      return <option key={id} value={id} disabled={state.status !== "ready"}>{metricRegistry[id].label}{state.status !== "ready" ? ` — ${state.message}` : ""}</option>;
    })}
  </select></Field>;
}

export function ProfileContentEditor({ profile, module, disabled, onChange, onClose }: { profile: PublicProfile; module: ContentModule; disabled: boolean; onChange: (section: ContentModule) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.querySelector<HTMLElement>("select, input, button")?.focus(); }, []);
  const config = module.type === "dataset" ? module.config : null;
  return <div ref={panel} className="mb-8 border-b border-[#3b3931] pb-6" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <legend className="sr-only">Edit section content</legend>
      {["single_stat", "stat_grid", "dataset"].includes(module.type) && <p className={hint}>Choose what you want to show. Only available, published data can be selected. <Link href="/settings/sync#publication" className="underline underline-offset-4">Manage publication</Link>. Layout changes never publish additional data.</p>}
      {module.type === "single_stat" && <>
        <MetricSelect label="Stat" profile={profile} value={module.metric} onChange={metric => onChange({ ...module, metric })} />
        {module.metric && <p className={hint}>{metricRegistry[module.metric].description}</p>}
        <Field label="Presentation"><select className="profile-field" value={module.style} onChange={event => onChange({ ...module, style: event.target.value as "number" | "label" | "context" })}><option value="number">Number</option><option value="label">Number + label</option><option value="context">Number + context</option></select></Field>
      </>}
      {module.type === "stat_grid" && <>
        <Field label="Grid layout"><select className="profile-field" value={`${module.columns}x${module.rows}`} onChange={event => {
          const [columns, rows] = event.target.value.split("x").map(Number) as [2 | 3, 2 | 3];
          onChange({ ...module, columns, rows, cells: Array.from({ length: columns * rows }, (_, index) => module.cells[index] ?? null) });
        }}>{["2x2", "3x2", "2x3", "3x3"].map(size => <option key={size} value={size}>{size.replace("x", " × ")}</option>)}</select></Field>
        <p className={hint}>Cells read across, then down. A smaller grid keeps the first cells; additional cells are removed from this draft.</p>
        <div className="grid gap-4">{module.cells.map((id, index) => <MetricSelect key={index} label={`Cell ${index + 1}`} profile={profile} value={id} onChange={metric => onChange({ ...module, cells: module.cells.map((previous, cell) => cell === index ? metric : previous) })} />)}</div>
      </>}
      {module.type === "dataset" && <>
        <Field label="Data to show"><select className="profile-field" value={config?.metric ?? ""} onChange={event => onChange({ ...module, config: event.target.value ? defaultDatasetConfig(event.target.value as DatasetMetric, config?.appearance) : null })}>
          <option value="">Choose data</option>{datasetMetricIds.map(id => { const state = publicMetricState(profile, id); return <option key={id} value={id} disabled={state.status !== "ready"}>{metricRegistry[id].label}{state.status !== "ready" ? ` — ${state.message}` : ""}</option>; })}
        </select></Field>
        {config && <>
          <p className={hint}>{metricRegistry[config.metric].description}</p>
          {config.metric !== "sessions.histogram" && <Field label="Measure"><select className="profile-field" value={config.measure} onChange={event => onChange({ ...module, config: { ...config, measure: event.target.value as Measure } })}>{measures.map(measure => <option key={measure} value={measure}>{measureLabels[measure]}</option>)}</select></Field>}
          <Field label="Presentation"><select className="profile-field" value={config.renderer} onChange={event => onChange({ ...module, config: { ...config, renderer: event.target.value as typeof config.renderer } })}>{compatibleContentRenderers(config.metric).map(renderer => <option key={renderer} value={renderer}>{contentRenderers[renderer].label}</option>)}</select></Field>
          <AppearanceControls appearance={config.appearance} onChange={appearance => onChange({ ...module, config: { ...config, appearance } })} />
        </>}
      </>}
      {module.type === "document" && <ExternalLinkFields initial={{ label: module.title, url: module.url }} kind="document" onApply={link => onChange({ ...module, title: link.label, url: link.url })} />}
      {module.type === "link_collection" && <>
        <ul className="space-y-2">{module.links.map((link, index) => <li key={index} className="flex items-center justify-between gap-2"><span className="min-w-0 break-words text-sm">{link.label}</span><button type="button" className={contentButton} aria-label={`Remove link ${link.label}`} onClick={() => onChange({ ...module, links: module.links.filter((_, row) => row !== index) })}>Remove</button></li>)}</ul>
        {module.links.length < 8 ? <ExternalLinkFields key={module.links.length} kind="link" onApply={link => onChange({ ...module, links: [...module.links, link] })} /> : <p className={hint}>Eight links added.</p>}
      </>}
      <button type="button" className={contentButton} onClick={onClose}>Done editing section</button>
    </fieldset>
  </div>;
}

function ExternalLinkFields({ initial, kind, onApply }: { initial?: { label: string; url: string }; kind: "link" | "document"; onApply: (link: { label: string; url: string }) => void }) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [error, setError] = useState("");
  return <div className="space-y-4">
    <p className={hint}>{kind === "document" ? "Link to a PDF or document hosted elsewhere. Files are not uploaded or embedded." : "Add a GitHub, website, LinkedIn, project or research link."} Apply this link before saving the layout.</p>
    <Field label={kind === "document" ? "Document title" : "Link label"}><input className="profile-field" maxLength={kind === "document" ? 100 : 80} value={label} onChange={event => setLabel(event.target.value)} /></Field>
    <Field label="HTTPS URL"><input type="url" className="profile-field" maxLength={2048} value={url} placeholder="https://example.com/" onChange={event => setUrl(event.target.value)} /></Field>
    {error && <p role="alert" className="text-xs text-[#e58b83]">{error}</p>}
    <button type="button" className={contentButton} onClick={() => {
      if (!label.trim() || !externalUrlSchema.safeParse(url).success) { setError("Enter a title and a full HTTPS URL without credentials or a custom port."); return; }
      setError(""); onApply({ label: label.trim(), url });
    }}>{kind === "document" ? "Apply document link" : "Add link"}</button>
  </div>;
}

function AppearanceControls({ appearance, onChange }: { appearance: ChartAppearance; onChange: (value: ChartAppearance) => void }) {
  const colors = resolveAppearance(appearance);
  return <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-[#c8c4b9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]">Appearance</summary>
    <Field label="Color palette"><select className="profile-field" value={appearance.palette} onChange={event => onChange(event.target.value === "custom" ? { palette: "custom", ...colors } : { palette: event.target.value as keyof typeof palettes })}>{Object.entries(palettes).map(([id, palette]) => <option key={id} value={id}>{palette.label}</option>)}<option value="custom">Custom colors</option></select></Field>
    {appearance.palette === "custom" && <div className="mt-4 grid grid-cols-2 gap-3">{colors.colors.map((color, index) => <Field key={index} label={`Data color ${index + 1}`}><input type="color" value={color} className="profile-field" onChange={event => onChange({ ...appearance, colors: colors.colors.map((previous, row) => row === index ? event.target.value : previous) })} /></Field>)}</div>}
    {appearanceWarnings(appearance).map(warning => <p className={hint} key={warning}>{warning}</p>)}
    <p className={`mt-3 ${hint}`}>Colors follow displayed order. Single-measure charts use the first color. Values remain readable in every palette.</p>
  </details>;
}
