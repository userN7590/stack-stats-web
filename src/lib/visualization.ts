import { z } from "zod";

import { getLanguageDisplayName } from "@/lib/language-display";
import type { PublicProfile } from "@/lib/types";

export const datasetIds = ["language_share", "line_changes"] as const;
export const rendererIds = ["bars", "dots", "radial_bars", "polar_area", "donut", "waterfall"] as const;
export type DatasetId = (typeof datasetIds)[number];
export type RendererId = (typeof rendererIds)[number];

export const datasetDefinitions = {
  language_share: { label: "Language activity", description: "The language shares already shown on your public profile.", kind: "share" },
  line_changes: { label: "Code changes", description: "Lines added and removed across your displayed activity.", kind: "change" },
} as const;

export const rendererDefinitions: Record<RendererId, {
  label: string; description: string; kind: "share" | "change"; appearance: "categorical" | "signed";
}> = {
  bars: { label: "Bars", description: "A clear comparison on a shared 0–100% scale.", kind: "share", appearance: "categorical" },
  dots: { label: "Dots", description: "A minimal portrait of your language mix.", kind: "share", appearance: "categorical" },
  radial_bars: { label: "Orbital rings", description: "Each ring sweeps through its share of a full circle.", kind: "share", appearance: "categorical" },
  polar_area: { label: "Language bloom", description: "Each petal’s area represents a language’s share.", kind: "share", appearance: "categorical" },
  donut: { label: "Donut", description: "Your language mix, one complete circle.", kind: "share", appearance: "categorical" },
  waterfall: { label: "Waterfall", description: "Added lines minus removed lines, ending at the edit balance.", kind: "change", appearance: "signed" },
};

export function compatibleRenderers(dataset: DatasetId): RendererId[] {
  return rendererIds.filter((id) => rendererDefinitions[id].kind === datasetDefinitions[dataset].kind);
}

export const palettes = {
  stack: { label: "Stack Stats", colors: ["#55A7FF", "#65C58F", "#D8AA54", "#C79EF5", "#F28FAD", "#75DCE8", "#FFAD7A", "#C8C4B9"], positive: "#65C58F", negative: "#D8AA54" },
  neon: { label: "Neon", colors: ["#63F5D2", "#E888FF", "#A5FB62", "#FF82B2", "#76BEFF", "#FFE570", "#C7A0FF", "#DDEEF5"], positive: "#63F5D2", negative: "#FF82B2" },
  ice: { label: "Ice", colors: ["#E1F7FF", "#96E3FF", "#55A7FF", "#AAC9FF", "#81D3D8", "#CACBFF", "#A1BADE", "#C8C4B9"], positive: "#96E3FF", negative: "#CACBFF" },
  sunset: { label: "Sunset", colors: ["#FFCA78", "#FF9F78", "#F7839C", "#DB91CD", "#B39CEF", "#D8AA54", "#FFDABA", "#C8C4B9"], positive: "#FFCA78", negative: "#DB91CD" },
  accessible: { label: "Accessible contrast", colors: ["#56B4E9", "#E69F00", "#F0E442", "#CC79A7", "#5DCEAE", "#FFFFFF", "#FFAB91", "#B5BDCB"], positive: "#56B4E9", negative: "#E69F00" },
  mono: { label: "Monochrome", colors: ["#FFFFFF", "#DDDDDD", "#BEBEBE", "#A3A3A3", "#8C8C8C", "#797979", "#B4B4B4", "#D1D1D1"], positive: "#FFFFFF", negative: "#A3A3A3" },
} as const;
export type PaletteId = keyof typeof palettes;
const paletteIds = ["stack", "neon", "ice", "sunset", "accessible", "mono"] as const;
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const appearanceSchema = z.union([
  z.strictObject({ palette: z.enum(paletteIds) }),
  z.strictObject({ palette: z.literal("custom"), colors: z.array(colorSchema).min(1).max(8).optional(), positive: colorSchema.optional(), negative: colorSchema.optional() }),
]);
export type ChartAppearance = z.infer<typeof appearanceSchema>;

export const visualizationConfigSchema = z.strictObject({
  version: z.literal(1),
  dataset: z.enum(datasetIds),
  renderer: z.enum(rendererIds),
  appearance: appearanceSchema,
}).refine((config) => compatibleRenderers(config.dataset).includes(config.renderer), {
  message: "Choose a chart that fits this data.", path: ["renderer"],
});
export type VisualizationConfig = z.infer<typeof visualizationConfigSchema>;

export function defaultVisualizationConfig(dataset: DatasetId = "language_share"): VisualizationConfig {
  return { version: 1, dataset, renderer: dataset === "language_share" ? "polar_area" : "waterfall", appearance: { palette: "stack" } };
}

/** Color damage can fall back independently; unknown chart semantics cannot. */
export function normalizeVisualizationConfig(raw: unknown): VisualizationConfig | null {
  const parsed = visualizationConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const repaired = visualizationConfigSchema.safeParse({ ...raw, appearance: { palette: "stack" } });
  return repaired.success ? repaired.data : null;
}

export function colorContrast(color: string): number {
  if (!colorSchema.safeParse(color).success) return 0;
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  return (luminance(color) + 0.05) / (luminance("#11110d") + 0.05);
}

export function resolveAppearance(appearance: ChartAppearance): { colors: string[]; positive: string; negative: string } {
  if (appearance.palette !== "custom") {
    const palette = palettes[appearance.palette];
    return { colors: [...palette.colors], positive: palette.positive, negative: palette.negative };
  }
  const base = palettes.stack;
  const safeColor = (color: string | undefined, fallback: string) => color && colorContrast(color) >= 3 ? color : fallback;
  return {
    colors: base.colors.map((fallback, index) => safeColor(appearance.colors?.[index], fallback)),
    positive: safeColor(appearance.positive, base.positive),
    negative: safeColor(appearance.negative, base.negative),
  };
}

export function appearanceWarnings(appearance: ChartAppearance): string[] {
  if (appearance.palette !== "custom") return [];
  return [...(appearance.colors ?? []), appearance.positive, appearance.negative]
    .some((color) => color && colorContrast(color) < 3)
    ? ["Some colors are too dark against this background. The preview uses readable defaults for those colors."] : [];
}

export type VisualizationDataset = {
  id: DatasetId;
  kind: "share" | "change";
  label: string;
  unit: "%" | "lines";
  rows: { id: string; label: string; value: number }[];
  sourceLabel: string;
  note: string;
  emptyMessage: string;
};

/** Accepts only the already-public profile projection; never fetches private telemetry. */
export function getVisualizationDataset(profile: PublicProfile, id: DatasetId): VisualizationDataset {
  const synced = profile.stats_source === "synced";
  const sourceLabel = synced ? "Automatically tracked by Stack Stats" : "Self-reported profile data";
  if (id === "line_changes") {
    const valid = [profile.lines_added, profile.lines_removed].every((value) => Number.isFinite(value) && value >= 0);
    return {
      id, kind: "change", label: "Code changes", unit: "lines", sourceLabel,
      rows: valid && profile.lines_added + profile.lines_removed > 0 ? [
        { id: "added", label: "Added", value: profile.lines_added },
        { id: "removed", label: "Removed", value: profile.lines_removed === 0 ? 0 : -profile.lines_removed },
      ] : [],
      note: "Added lines minus removed lines gives the edit balance. These are editing totals, not repository size, committed code, or a productivity score.",
      emptyMessage: "No added or removed lines are available to display.",
    };
  }
  const base: VisualizationDataset = {
    id, kind: "share", label: "Language activity", unit: "%", sourceLabel, rows: [],
    note: synced ? "Share of published language activity: tracked time, or edit count when no timed activity is available. This is activity, not proficiency." : "Percentages entered by the profile owner. This is a reported activity mix, not proficiency.",
    emptyMessage: synced ? "No language activity is published." : "No language activity has been added yet.",
  };
  const values = profile.languages.filter((row) => row.name.trim() && Number.isFinite(row.percentage) && row.percentage > 0 && row.percentage <= 100);
  if (values.length !== profile.languages.filter((row) => row.percentage !== 0).length) {
    return { ...base, emptyMessage: "The available language percentages cannot be displayed reliably." };
  }
  const total = values.reduce((sum, row) => sum + row.percentage, 0);
  if (total > 100.01 + 1e-6) return { ...base, emptyMessage: "The language percentages exceed 100%. Update the reported percentages to display this chart." };
  if (!total) return base;
  if (total > 100 + 1e-6) base.note += " A small rounding excess was adjusted to total 100%.";
  const rows = values.map((row) => ({ id: row.id, label: getLanguageDisplayName(row.name), value: total > 100 ? row.percentage / total * 100 : row.percentage }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  if (100 - total > 1e-6) {
    rows.push({ id: "unassigned-share", label: "Unspecified", value: 100 - total });
    base.note += " Unspecified is the remainder of 100%; it does not represent additional tracked activity.";
  }
  // Bound geometry and palette controls without silently dropping small shares.
  if (rows.length > 8) {
    const rest = rows.splice(7);
    rows.push({ id: "remaining-share", label: "Other shares", value: rest.reduce((sum, row) => sum + row.value, 0) });
    base.note += ` Other shares combines ${rest.length} remaining entries.`;
  }
  return { ...base, rows };
}
