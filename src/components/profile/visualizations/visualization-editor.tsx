"use client";

import { useRef, useState } from "react";

import { VisualizationChart } from "@/components/profile/visualizations/visualization-chart";
import { appearanceWarnings, compatibleRenderers, datasetDefinitions, datasetIds, defaultVisualizationConfig, getVisualizationDataset, palettes, rendererDefinitions, resolveAppearance, type ChartAppearance, type VisualizationConfig } from "@/lib/visualization";
import type { PublicProfile } from "@/lib/types";

const choice = "min-h-11 rounded-[3px] border border-[#3b3931] p-3 text-left text-xs text-[#c8c4b9] transition hover:border-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] aria-pressed:border-[#55a7ff] aria-pressed:bg-[#55a7ff]/5 disabled:opacity-40";

export function VisualizationEditor({ profile, config, disabled, initialOpen, canRemove, onChange, onRemove }: {
  profile: PublicProfile;
  config: VisualizationConfig;
  disabled: boolean;
  initialOpen: boolean;
  canRemove: boolean;
  onChange: (config: VisualizationConfig) => void;
  onRemove: () => void;
}) {
  const summary = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(initialOpen);
  const dataset = getVisualizationDataset(profile, config.dataset);
  const appearance = resolveAppearance(config.appearance);
  const custom = config.appearance.palette === "custom" ? config.appearance : undefined;
  const warnings = appearanceWarnings(config.appearance);
  const setAppearance = (value: ChartAppearance) => onChange({ ...config, appearance: value });
  const colorControls = rendererDefinitions[config.renderer].appearance === "signed"
    ? [{ key: "positive" as const, label: "Added / positive", color: custom?.positive ?? appearance.positive }, { key: "negative" as const, label: "Removed / negative", color: custom?.negative ?? appearance.negative }]
    : dataset.rows.map((row, index) => ({ key: index, label: row.label, color: custom?.colors?.[index] ?? appearance.colors[index] }));

  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="mb-6 border-b border-[#3b3931] pb-4">
    <summary ref={summary} className="min-h-11 cursor-pointer rounded-sm py-3 font-mono text-xs text-[#c8c4b9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]">Chart style & colors</summary>
    <fieldset disabled={disabled} className="min-w-0 space-y-5 pt-3">
      <legend className="sr-only">Customize visualization</legend>
      <div role="group" aria-label="Data to show">
        <p className="mb-2 font-mono text-xs text-[#edeae0]">Show</p>
        <div className="grid gap-2 sm:grid-cols-2">{datasetIds.map((id) => <button key={id} type="button" className={choice} aria-pressed={config.dataset === id} onClick={() => onChange({ ...defaultVisualizationConfig(id), appearance: config.appearance })}><span className="block font-mono">{datasetDefinitions[id].label}</span><span className="mt-1 block leading-5 text-[#969287]">{datasetDefinitions[id].description}</span></button>)}</div>
      </div>
      <div role="group" aria-label="Chart style">
        <p className="mb-2 font-mono text-xs text-[#edeae0]">Choose a style</p>
        <div className="grid grid-cols-2 gap-2">{compatibleRenderers(config.dataset).map((id) => <button key={id} type="button" aria-label={`Use ${rendererDefinitions[id].label}`} aria-pressed={config.renderer === id} className={`${choice} min-w-0`} onClick={() => onChange({ ...config, renderer: id })}>
          <span aria-hidden="true" inert className="block max-h-28 overflow-hidden"><VisualizationChart dataset={dataset} config={{ ...config, renderer: id }} thumbnail /></span>
          <span className="mt-2 block font-mono">{rendererDefinitions[id].label}</span>
        </button>)}</div>
      </div>
      <div role="group" aria-label="Color scheme">
        <p className="mb-2 font-mono text-xs text-[#edeae0]">Color scheme</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(palettes).map(([id, palette]) => <button key={id} type="button" className={choice} aria-label={`${palette.label} palette`} aria-pressed={config.appearance.palette === id} onClick={() => setAppearance({ palette: id as keyof typeof palettes })}>
          <span aria-hidden="true" className="mb-2 flex overflow-hidden rounded-sm">{palette.colors.slice(0, 5).map((color) => <span key={color} className="h-3 flex-1" style={{ backgroundColor: color }} />)}</span>{palette.label}
        </button>)}<button type="button" className={choice} aria-pressed={config.appearance.palette === "custom"} onClick={() => setAppearance({ palette: "custom", ...appearance })}>Custom colors</button></div>
      </div>
      {config.appearance.palette === "custom" && <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Custom colors">
        {colorControls.map((control) => <label key={control.key} className="flex min-w-0 items-center gap-3 text-xs text-[#c8c4b9]">
          <input type="color" value={control.color} aria-label={`${control.label} color`} className="size-11 shrink-0 cursor-pointer rounded-sm border border-[#3b3931] bg-transparent p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]" onChange={(event) => {
            const next = { palette: "custom" as const, colors: [...(custom?.colors ?? appearance.colors)], positive: custom?.positive ?? appearance.positive, negative: custom?.negative ?? appearance.negative };
            if (typeof control.key === "number") next.colors[control.key] = event.target.value;
            else next[control.key] = event.target.value;
            setAppearance(next);
          }} /><span className="break-words">{control.label}</span>
        </label>)}
      </div>}
      {custom && dataset.kind === "share" && <p className="text-xs leading-5 text-[#969287]">Colors follow the displayed share order as your activity changes.</p>}
      {warnings.map((warning) => <p key={warning} role="status" className="text-xs leading-5 text-[#d8aa54]">{warning}</p>)}
      <p className="text-xs leading-5 text-[#858177]">Labels and values stay readable in every color scheme. Colors change the presentation, not the data.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={choice} onClick={() => { setOpen(false); summary.current?.focus(); }}>Done</button>
        <button type="button" className={choice} onClick={() => setAppearance({ palette: "stack" })}>Reset colors</button>
        <button type="button" className={choice} disabled={!canRemove} onClick={onRemove}>Remove visualization</button>
      </div>
    </fieldset>
  </details>;
}
