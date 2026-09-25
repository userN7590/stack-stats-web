import { z } from "zod";

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
export type ModuleType = "stats" | "code_changes" | "languages" | "links" | "visualization";
export type ModuleSize = "full" | "half";

export const moduleDefinitions: Record<
  ModuleType,
  { label: string; description: string; sizes: readonly ModuleSize[] }
> = {
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

const moduleSchema = z.discriminatedUnion("type", [
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
export const profileLayoutSchema = z
  .strictObject({
    version: z.union([z.literal(1), z.literal(2)]),
    modules: z.array(moduleSchema).min(4).max(10),
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

export type ProfileModule = z.infer<typeof moduleSchema>;
export type ProfileLayout = z.infer<typeof profileLayoutSchema>;

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

function isModuleType(value: unknown): value is ModuleType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(moduleDefinitions, value)
  );
}

function isStatId(value: unknown): value is StatId {
  return typeof value === "string" && statIds.some((stat) => stat === value);
}

/** A future layout can be displayed with defaults, but must not be overwritten by this editor. */
export function isUnsupportedLayoutVersion(raw: unknown): boolean {
  return isRecord(raw) && typeof raw.version === "number" && raw.version !== 1 && raw.version !== 2;
}

/**
 * Read defensively without changing the stored configuration. Keep recoverable
 * choices, omit unknown sections, and leave newly introduced sections hidden.
 */
export function normalizeProfileLayout(raw: unknown): ProfileLayout {
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
  return {
    ...layout,
    modules: layout.modules.map((module) =>
      getModuleKey(module) === type && module.type !== "stats" ? { ...module, size } : module,
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
  return section.type === "visualization" ? section.id : section.type;
}

export function getModuleLabel(section: ProfileModule): string {
  return section.type === "visualization" ? rendererDefinitions[section.config.renderer].label : moduleDefinitions[section.type].label;
}

/** Unknown semantics are omitted publicly; the editor locks saves to preserve them. */
export function hasUnsupportedVisualizations(raw: unknown): boolean {
  if (!isRecord(raw) || raw.version !== 2 || !Array.isArray(raw.modules)) return false;
  return raw.modules.some((row) => isRecord(row) && (
    !isModuleType(row.type) || (row.type === "visualization" && !normalizeVisualizationConfig(row.config))
  ));
}

export function addVisualization(layout: ProfileLayout, id: string, config = defaultVisualizationConfig()): ProfileLayout {
  if (layout.modules.filter((module) => module.type === "visualization").length >= 6 ||
    layout.modules.some((module) => getModuleKey(module) === id) || !/^viz_[a-z0-9-]{1,64}$/.test(id) ||
    !visualizationConfigSchema.safeParse(config).success) return layout;
  return { version: 2, modules: [...layout.modules, { type: "visualization", id, visible: true, size: "full", config }] };
}

export function setVisualizationConfig(layout: ProfileLayout, id: string, config: VisualizationConfig): ProfileLayout {
  if (!visualizationConfigSchema.safeParse(config).success) return layout;
  return { ...layout, modules: layout.modules.map((module) => module.type === "visualization" && module.id === id ? { ...module, config } : module) };
}

export function removeVisualization(layout: ProfileLayout, id: string): ProfileLayout {
  if (!layout.modules.some((module) => getModuleKey(module) !== id && module.visible)) return layout;
  return { ...layout, modules: layout.modules.filter((module) => module.type !== "visualization" || module.id !== id) };
}
