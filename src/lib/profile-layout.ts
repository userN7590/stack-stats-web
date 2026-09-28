import { z } from "zod";
import { contentModuleSchema, contentSizes, newContentModule, publicMetricState, scalarMetricIds, defaultDatasetConfig, type ContentType, type ContentModule } from "@/lib/profile-content";
import type { PublicProfile } from "@/lib/types";
import { metricRegistry } from "@/lib/metric-registry";

import { defaultVisualizationConfig, normalizeVisualizationConfig, rendererDefinitions, visualizationConfigSchema, type VisualizationConfig } from "@/lib/visualization";

export const statIds = [
  "lines_added",
  "lines_removed",
  "files_changed",
  "edit_events",
  "projects_count",
  "coding_minutes",
] as const;

export type StatId = (typeof statIds)[number];
type LegacyModuleType = "stats" | "code_changes" | "languages" | "links" | "visualization";
export type ModuleType = LegacyModuleType | ContentType;
export type ModuleSize = typeof contentSizes[number];

export const moduleDefinitions: Record<
  ModuleType,
  { label: string; description: string; sizes: readonly ModuleSize[] }
> = {
  single_stat: { label: "Single stat", description: "One metric, with your chosen presentation.", sizes: contentSizes },
  stat_grid: { label: "Stat grid", description: "Choose a metric for each cell in a shared grid.", sizes: contentSizes },
  dataset: { label: "Dataset visualization", description: "Choose activity data, then how to show it.", sizes: contentSizes },
  link_collection: { label: "Links", description: "Developer profiles, projects, research and websites.", sizes: contentSizes },
  document: { label: "Document / PDF", description: "Link to a resume, research paper or technical document.", sizes: contentSizes },
  visualization: { label: "Visualization", description: "Show your activity in a style that feels like you.", sizes: ["full", "half"] },
  stats: {
    label: "Headline stats",
    description: "Choose the coding totals you want to highlight.",
    sizes: ["full"],
  },
  code_changes: {
    label: "Code changes",
    description: "Show your added and removed lines of code.",
    sizes: ["full", "half"],
  },
  languages: {
    label: "Languages",
    description: "Show your published language activity.",
    sizes: ["full", "half"],
  },
  links: {
    label: "Links",
    description: "Help people find your GitHub and website.",
    sizes: ["full", "half"],
  },
};

const statSelectionSchema = z
  .array(z.enum(statIds))
  .min(1)
  .max(statIds.length)
  .refine((stats) => new Set(stats).size === stats.length, {
    message: "Choose each stat only once.",
  });

const legacyModuleSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("visualization"),
    id: z.string().regex(/^viz_[a-z0-9-]{1,64}$/),
    visible: z.boolean(),
    size: z.enum(["full", "half"]),
    config: visualizationConfigSchema,
  }),
  z.strictObject({
    type: z.literal("stats"),
    visible: z.boolean(),
    size: z.literal("full"),
    stats: statSelectionSchema,
  }),
  z.strictObject({
    type: z.literal("code_changes"),
    visible: z.boolean(),
    size: z.enum(["full", "half"]),
  }),
  z.strictObject({
    type: z.literal("languages"),
    visible: z.boolean(),
    size: z.enum(["full", "half"]),
  }),
  z.strictObject({
    type: z.literal("links"),
    visible: z.boolean(),
    size: z.enum(["full", "half"]),
  }),
]);

/** Saving is strict; older or damaged stored layouts are handled by the reader below. */
const legacyLayoutSchema = z
  .strictObject({
    version: z.union([z.literal(1), z.literal(2)]),
    modules: z.array(legacyModuleSchema).min(4).max(10),
  })
  .superRefine((layout, context) => {
    const core = layout.modules.filter((module) => module.type !== "visualization");
    const visualizations = layout.modules.filter((module) => module.type === "visualization");
    if (core.length !== 4 || new Set(core.map((module) => module.type)).size !== 4 ||
      new Set(visualizations.map((module) => module.id)).size !== visualizations.length ||
      (layout.version === 1 && visualizations.length > 0)) {
      context.addIssue({
        code: "custom",
        path: ["modules"],
        message: "Include each core section once and give each visualization a unique identity.",
      });
    }
    if (!layout.modules.some((module) => module.visible)) {
      context.addIssue({
        code: "custom",
        path: ["modules"],
        message: "Keep at least one section visible.",
      });
    }
  });

export const profileModuleSchema = z.union([legacyModuleSchema, contentModuleSchema]);
const layoutV3Schema = z.strictObject({ version: z.literal(3), modules: z.array(profileModuleSchema).min(1).max(20) }).superRefine((layout, context) => {
  const keys = layout.modules.map(getModuleKey);
  if (new Set(keys).size !== keys.length || layout.modules.filter(module => module.type === "visualization").length > 6 || !layout.modules.some(module => module.visible)) {
    context.addIssue({ code: "custom", path: ["modules"], message: "Each section needs a unique identity and at least one must remain visible." });
  }
});
export const profileLayoutSchema = z.union([legacyLayoutSchema, layoutV3Schema]);
export type ProfileModule = z.infer<typeof profileModuleSchema>;
export type ProfileLayout = { version: 1 | 2 | 3; modules: ProfileModule[] };
export function isContentModule(module: ProfileModule): module is ContentModule {
  return "id" in module && module.type !== "visualization";
}

/** Every caller gets independent arrays, including the selected stats. */
export function getDefaultProfileLayout(): ProfileLayout {
  return {
    version: 1,
    modules: [
      { type: "links", visible: true, size: "full" },
      { type: "stats", visible: true, size: "full", stats: [...statIds] },
      { type: "code_changes", visible: true, size: "full" },
      { type: "languages", visible: true, size: "full" },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModuleType(value: unknown): value is LegacyModuleType {
  return (
    typeof value === "string" &&
    ["stats", "code_changes", "languages", "links", "visualization"].includes(value)
  );
}

function isStatId(value: unknown): value is StatId {
  return typeof value === "string" && statIds.some((stat) => stat === value);
}

/** A future layout can be displayed with defaults, but must not be overwritten by this editor. */
export function isUnsupportedLayoutVersion(raw: unknown): boolean {
  return isRecord(raw) && typeof raw.version === "number" && raw.version !== 1 && raw.version !== 2 && raw.version !== 3;
}

/**
 * Read defensively without changing the stored configuration. Keep recoverable
 * choices, omit unknown sections, and leave newly introduced sections hidden.
 */
export function normalizeProfileLayout(raw: unknown): ProfileLayout {
  if (isRecord(raw) && raw.version === 3 && Array.isArray(raw.modules)) {
    const seen = new Set<string>();
    const modules: ProfileModule[] = [];
    for (const value of raw.modules.slice(0, 20)) {
      const parsed = profileModuleSchema.safeParse(value);
      if (!parsed.success || seen.has(getModuleKey(parsed.data))) continue;
      seen.add(getModuleKey(parsed.data));
      modules.push(parsed.data);
    }
    // Never substitute unrelated defaults for unknown/new v3 sections.
    return { version: 3, modules };
  }
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2) || !Array.isArray(raw.modules)) {
    return getDefaultProfileLayout();
  }

  const modules: ProfileModule[] = [];
  const seen = new Set<string>();

  for (const row of raw.modules) {
    if (
      !isRecord(row) ||
      !isModuleType(row.type) ||
      typeof row.visible !== "boolean" ||
      seen.has(row.type === "visualization" ? String(row.id) : row.type)
    ) {
      continue;
    }

    const size =
      row.size === "half" && moduleDefinitions[row.type].sizes.includes("half")
        ? "half"
        : "full";

    if (row.type === "visualization") {
      if (raw.version !== 2 || typeof row.id !== "string" || !/^viz_[a-z0-9-]{1,64}$/.test(row.id)) continue;
      const config = normalizeVisualizationConfig(row.config);
      if (!config || modules.filter((section) => section.type === "visualization").length >= 6) continue;
      modules.push({ type: "visualization", id: row.id, visible: row.visible, size, config });
    } else if (row.type === "stats") {
      const stats = Array.isArray(row.stats)
        ? [...new Set(row.stats.filter(isStatId))]
        : [];
      modules.push({
        type: "stats",
        visible: row.visible,
        size: "full",
        stats: stats.length > 0 ? stats : [...statIds],
      });
    } else {
      modules.push({ type: row.type, visible: row.visible, size });
    }
    seen.add(row.type === "visualization" ? String(row.id) : row.type);
  }

  if (!modules.some((module) => module.visible) && !hasUnsupportedVisualizations(raw)) {
    return getDefaultProfileLayout();
  }

  for (const section of getDefaultProfileLayout().modules) {
    if (!seen.has(section.type)) {
      modules.push({ ...section, visible: false });
    }
  }

  return { version: raw.version, modules };
}

/** Move by one visible section, so a hidden section never consumes a click. */
export function moveModule(
  layout: ProfileLayout,
  type: string,
  direction: -1 | 1,
): ProfileLayout {
  const index = layout.modules.findIndex((module) => getModuleKey(module) === type);
  if (index < 0 || !layout.modules[index].visible) return layout;

  let target = index + direction;
  while (target >= 0 && target < layout.modules.length) {
    if (layout.modules[target].visible) {
      const modules = [...layout.modules];
      [modules[index], modules[target]] = [modules[target], modules[index]];
      return { ...layout, modules };
    }
    target += direction;
  }
  return layout;
}

/** Drag to a visible position, keeping hidden sections in their saved slots. */
export function moveModuleTo(
  layout: ProfileLayout,
  type: string,
  targetType: string,
): ProfileLayout {
  const visible = layout.modules.filter((module) => module.visible);
  const from = visible.findIndex((module) => getModuleKey(module) === type);
  const to = visible.findIndex((module) => getModuleKey(module) === targetType);
  if (from < 0 || to < 0 || from === to) return layout;
  const [moved] = visible.splice(from, 1);
  visible.splice(to, 0, moved);
  let index = 0;
  return {
    ...layout,
    modules: layout.modules.map((module) => module.visible ? visible[index++] : module),
  };
}

export function setModuleVisibility(
  layout: ProfileLayout,
  type: string,
  visible: boolean,
): ProfileLayout {
  if (!visible && !layout.modules.some((module) => getModuleKey(module) !== type && module.visible)) {
    return layout;
  }
  return {
    ...layout,
    modules: layout.modules.map((module) =>
      getModuleKey(module) === type ? { ...module, visible } : module,
    ),
  };
}

export function setModuleSize(
  layout: ProfileLayout,
  type: string,
  size: ModuleSize,
): ProfileLayout {
  const section = layout.modules.find((module) => getModuleKey(module) === type);
  if (!section || !moduleDefinitions[section.type].sizes.includes(size)) return layout;
  if (!isContentModule(section) && size !== "full" && size !== "half") return layout;
  return {
    ...layout,
    modules: layout.modules.map((module) =>
      getModuleKey(module) === type && module.type !== "stats" ? { ...module, size } as ProfileModule : module,
    ),
  };
}

export function toggleStat(layout: ProfileLayout, stat: StatId): ProfileLayout {
  return {
    ...layout,
    modules: layout.modules.map((module) => {
      if (module.type !== "stats") return module;
      const selected = module.stats.includes(stat);
      if (selected && module.stats.length === 1) return module;
      return {
        ...module,
        stats: selected
          ? module.stats.filter((selectedStat) => selectedStat !== stat)
          : [...module.stats, stat],
      };
    }),
  };
}

export function moveStat(
  layout: ProfileLayout,
  stat: StatId,
  direction: -1 | 1,
): ProfileLayout {
  return {
    ...layout,
    modules: layout.modules.map((module) => {
      if (module.type !== "stats") return module;
      const index = module.stats.indexOf(stat);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= module.stats.length) return module;
      const stats = [...module.stats];
      [stats[index], stats[target]] = [stats[target], stats[index]];
      return { ...module, stats };
    }),
  };
}


export function getModuleKey(section: ProfileModule): string {
  return "id" in section ? section.id : section.type;
}

export function getModuleLabel(section: ProfileModule): string {
  if (section.type === "single_stat" && section.metric) return metricRegistry[section.metric].label;
  if (section.type === "dataset" && section.config) return metricRegistry[section.config.metric].label;
  return section.type === "visualization" ? rendererDefinitions[section.config.renderer].label : moduleDefinitions[section.type].label;
}

/** Unknown semantics are omitted publicly; the editor locks saves to preserve them. */
export function hasUnsupportedVisualizations(raw: unknown): boolean {
  if (isRecord(raw) && raw.version === 3) return !layoutV3Schema.safeParse(raw).success;
  if (!isRecord(raw) || raw.version !== 2 || !Array.isArray(raw.modules)) return false;
  return raw.modules.some((row) => isRecord(row) && (
    !isModuleType(row.type) || (row.type === "visualization" && !normalizeVisualizationConfig(row.config))
  ));
}

export function addVisualization(layout: ProfileLayout, id: string, config = defaultVisualizationConfig()): ProfileLayout {
  if (layout.modules.filter((module) => module.type === "visualization").length >= 6 ||
    layout.modules.some((module) => getModuleKey(module) === id) || !/^viz_[a-z0-9-]{1,64}$/.test(id) ||
    !visualizationConfigSchema.safeParse(config).success) return layout;
  return { version: layout.version === 3 ? 3 : 2, modules: [...layout.modules, { type: "visualization", id, visible: true, size: "full", config }] };
}

export function setVisualizationConfig(layout: ProfileLayout, id: string, config: VisualizationConfig): ProfileLayout {
  if (!visualizationConfigSchema.safeParse(config).success) return layout;
  return { ...layout, modules: layout.modules.map((module) => module.type === "visualization" && module.id === id ? { ...module, config } : module) };
}

export function removeVisualization(layout: ProfileLayout, id: string): ProfileLayout {
  if (!layout.modules.some((module) => getModuleKey(module) !== id && module.visible)) return layout;
  return { ...layout, modules: layout.modules.filter((module) => module.type !== "visualization" || module.id !== id) };
}

/** Adding content promotes only the envelope; existing sections are untouched. */
export function addContentModule(layout: ProfileLayout, type: ContentType, id: string): ProfileLayout {
  const next = { version: 3 as const, modules: [...layout.modules, newContentModule(type, id)] };
  return profileLayoutSchema.safeParse(next).success ? next : layout;
}
export function replaceContentModule(layout: ProfileLayout, section: ContentModule): ProfileLayout {
  const next = { ...layout, modules: layout.modules.map(module => getModuleKey(module) === section.id ? section : module) };
  return profileLayoutSchema.safeParse(next).success ? next : layout;
}
export function removeModule(layout: ProfileLayout, key: string): ProfileLayout {
  const next = { version: 3 as const, modules: layout.modules.filter(module => getModuleKey(module) !== key) };
  return profileLayoutSchema.safeParse(next).success ? next : layout;
}
export const moduleSizeLabels: Record<ModuleSize, string> = { full: "Full width", two_thirds: "Two-thirds width", half: "Half width", third: "One-third width" };
export function moduleSpan(size: ModuleSize) {
  return { full: "profile-span-full", two_thirds: "profile-span-two-thirds", half: "profile-span-half", third: "profile-span-third" }[size];
}

/** A fresh selected-publication profile can start from its actual approved data.
 * Manual and legacy publication keep their original defaults and semantics. */
export function getDefaultLayoutForProfile(profile: PublicProfile): ProfileLayout {
  if (!profile.published_metrics) return getDefaultProfileLayout();
  const metrics = scalarMetricIds.filter(id => publicMetricState(profile, id).status === "ready").slice(0, 6);
  const columns = metrics.length > 4 ? 3 : 2;
  const modules: ProfileModule[] = [{ type: "stat_grid", id: "sec_default-stats", visible: true, size: "full", columns, rows: 2, cells: Array.from({ length: columns * 2 }, (_, index) => metrics[index] ?? null) }];
  if (publicMetricState(profile, "languages.activity").status === "ready") modules.push({ type: "dataset", id: "sec_default-languages", visible: true, size: "full", config: defaultDatasetConfig("languages.activity") });
  if (profile.github_url || profile.website_url) modules.push({ type: "links", visible: true, size: "full" });
  return { version: 3, modules };
}
export function getProfileLayout(profile: PublicProfile): ProfileLayout {
  return profile.profile_layout == null ? getDefaultLayoutForProfile(profile) : normalizeProfileLayout(profile.profile_layout);
}
