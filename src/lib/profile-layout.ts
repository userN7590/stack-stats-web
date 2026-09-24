import { z } from "zod";

export const statIds = [
  "lines_added",
  "lines_removed",
  "files_changed",
  "edit_events",
  "projects_count",
  "coding_minutes",
] as const;

export type StatId = (typeof statIds)[number];
export type ModuleType = "stats" | "code_changes" | "languages" | "links";
export type ModuleSize = "full" | "half";

export const moduleDefinitions: Record<
  ModuleType,
  { label: string; description: string; sizes: readonly ModuleSize[] }
> = {
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
    version: z.literal(1),
    modules: z.array(moduleSchema).length(4),
  })
  .superRefine((layout, context) => {
    if (new Set(layout.modules.map((module) => module.type)).size !== 4) {
      context.addIssue({
        code: "custom",
        path: ["modules"],
        message: "Include each section exactly once.",
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
  return isRecord(raw) && typeof raw.version === "number" && raw.version !== 1;
}

/**
 * Read defensively without changing the stored configuration. Keep recoverable
 * choices, omit unknown sections, and leave newly introduced sections hidden.
 */
export function normalizeProfileLayout(raw: unknown): ProfileLayout {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.modules)) {
    return getDefaultProfileLayout();
  }

  const modules: ProfileModule[] = [];
  const seen = new Set<ModuleType>();

  for (const row of raw.modules) {
    if (
      !isRecord(row) ||
      !isModuleType(row.type) ||
      typeof row.visible !== "boolean" ||
      seen.has(row.type)
    ) {
      continue;
    }

    const size =
      row.size === "half" && moduleDefinitions[row.type].sizes.includes("half")
        ? "half"
        : "full";

    if (row.type === "stats") {
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
    seen.add(row.type);
  }

  if (!modules.some((module) => module.visible)) {
    return getDefaultProfileLayout();
  }

  for (const section of getDefaultProfileLayout().modules) {
    if (!seen.has(section.type)) {
      modules.push({ ...section, visible: false });
    }
  }

  return { version: 1, modules };
}

/** Move by one visible section, so a hidden section never consumes a click. */
export function moveModule(
  layout: ProfileLayout,
  type: ModuleType,
  direction: -1 | 1,
): ProfileLayout {
  const index = layout.modules.findIndex((module) => module.type === type);
  if (index < 0) return layout;

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

export function setModuleVisibility(
  layout: ProfileLayout,
  type: ModuleType,
  visible: boolean,
): ProfileLayout {
  if (!visible && !layout.modules.some((module) => module.type !== type && module.visible)) {
    return layout;
  }
  return {
    ...layout,
    modules: layout.modules.map((module) =>
      module.type === type ? { ...module, visible } : module,
    ),
  };
}

export function setModuleSize(
  layout: ProfileLayout,
  type: ModuleType,
  size: ModuleSize,
): ProfileLayout {
  if (!moduleDefinitions[type].sizes.includes(size)) return layout;
  return {
    ...layout,
    modules: layout.modules.map((module) =>
      module.type === type && module.type !== "stats" ? { ...module, size } : module,
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
