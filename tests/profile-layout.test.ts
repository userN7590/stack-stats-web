import { describe, expect, it } from "vitest";

import {
  getDefaultProfileLayout,
  isUnsupportedLayoutVersion,
  moduleDefinitions,
  moveModule,
  moveModuleTo,
  moveStat,
  normalizeProfileLayout,
  profileLayoutSchema,
  setModuleSize,
  setModuleVisibility,
  statIds,
  toggleStat,
  type ProfileLayout,
} from "../src/lib/profile-layout";

function selectedStats(layout: ProfileLayout) {
  const section = layout.modules.find((module) => module.type === "stats");
  if (!section) throw new Error("Expected a headline stats section");
  return section.stats;
}

describe("default profile layout", () => {
  it("preserves the existing content order and all six available headline stats", () => {
    const layout = getDefaultProfileLayout();
    expect(layout.modules.map((module) => module.type)).toEqual([
      "links", "stats", "code_changes", "languages",
    ]);
    expect(layout.modules.every((module) => module.visible && module.size === "full")).toBe(true);
    expect(selectedStats(layout)).toEqual(statIds);
    expect(profileLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("returns independently editable defaults and nested stat arrays", () => {
    const first = getDefaultProfileLayout();
    first.modules[0].visible = false;
    selectedStats(first).pop();
    expect(getDefaultProfileLayout().modules[0].visible).toBe(true);
    expect(selectedStats(getDefaultProfileLayout())).toHaveLength(6);
  });
});

describe("stored profile layout normalization", () => {
  it.each([undefined, null, false, [], {}, { modules: [] }, { version: 2, modules: [] }, { version: "1", modules: [] }, { version: 1, modules: null }, { version: 1, modules: [] }])(
    "falls back for missing, unsupported, or unusable configuration: %j",
    (raw) => {
      expect(normalizeProfileLayout(raw)).toEqual(getDefaultProfileLayout());
    },
  );

  it("round-trips custom order, visibility, size, and selected stat order", () => {
    const layout = getDefaultProfileLayout();
    layout.modules.reverse();
    layout.modules[0].size = "half";
    layout.modules[1].visible = false;
    const stats = layout.modules.find((module) => module.type === "stats")!;
    stats.stats = ["coding_minutes", "lines_added"];
    const stored = JSON.parse(JSON.stringify(layout));
    expect(normalizeProfileLayout(stored)).toEqual(layout);
    expect(profileLayoutSchema.parse(stored)).toEqual(layout);
  });

  it("recovers known sections in order and appends missing sections hidden", () => {
    const layout = normalizeProfileLayout({
      version: 1,
      modules: [
        null,
        { type: "future_heatmap", visible: true, size: "half" },
        { type: "links", visible: "invalid", size: "half" },
        { type: "languages", visible: true, size: "half", future: "ignored" },
        { type: "links", visible: false, size: "full" },
        { type: "links", visible: true, size: "half" },
      ],
    });
    expect(layout.modules).toEqual([
      { type: "languages", visible: true, size: "half" },
      { type: "links", visible: false, size: "full" },
      { type: "stats", visible: false, size: "full", stats: [...statIds] },
      { type: "code_changes", visible: false, size: "full" },
    ]);
    expect(profileLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("repairs unsupported sizes and filters invalid or duplicate stats without changing their order", () => {
    const layout = normalizeProfileLayout({
      version: 1,
      modules: [
        { type: "stats", visible: true, size: "half", stats: ["coding_minutes", "sessions", "lines_added", "coding_minutes", null] },
        { type: "languages", visible: true, size: "huge", stats: ["lines_added"] },
      ],
    });
    expect(layout.modules[0]).toEqual({
      type: "stats", visible: true, size: "full", stats: ["coding_minutes", "lines_added"],
    });
    expect(layout.modules[1]).toEqual({ type: "languages", visible: true, size: "full" });
    expect(profileLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it.each([undefined, [], ["sessions"], "lines_added"])("uses default stats if the selection is unusable: %j", (stats) => {
    const layout = normalizeProfileLayout({
      version: 1,
      modules: [{ type: "stats", visible: true, size: "full", stats }],
    });
    expect(selectedStats(layout)).toEqual(statIds);
  });

  it("falls back if every recovered section is hidden or invalid", () => {
    expect(normalizeProfileLayout({
      version: 1,
      modules: [
        { type: "links", visible: false, size: "full" },
        { type: "__proto__", visible: true, size: "full" },
        { type: "constructor", visible: true, size: "full" },
      ],
    })).toEqual(getDefaultProfileLayout());
  });

  it("never mutates or reuses the stored section and stat arrays", () => {
    const raw = getDefaultProfileLayout();
    const before = JSON.stringify(raw);
    const normalized = normalizeProfileLayout(raw);
    normalized.modules.reverse();
    selectedStats(normalized).pop();
    normalized.modules[0].visible = false;
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("identifies unsupported numeric versions so the editor can preserve future configurations", () => {
    expect(isUnsupportedLayoutVersion({ version: 3 })).toBe(true);
    expect(isUnsupportedLayoutVersion({ version: 2 })).toBe(false);
    expect(isUnsupportedLayoutVersion({ version: 0 })).toBe(true);
    expect(isUnsupportedLayoutVersion({ version: 1 })).toBe(false);
    expect(isUnsupportedLayoutVersion(null)).toBe(false);
    expect(isUnsupportedLayoutVersion({})).toBe(false);
    expect(isUnsupportedLayoutVersion({ version: "2" })).toBe(false);
  });
});

describe("strict profile layout save validation", () => {
  it.each([
    ["future version", (layout: ProfileLayout) => ({ ...layout, version: 3 })],
    ["extra top-level field", (layout: ProfileLayout) => ({ ...layout, theme: "custom" })],
    ["missing section", (layout: ProfileLayout) => ({ ...layout, modules: layout.modules.slice(1) })],
    ["duplicate section", (layout: ProfileLayout) => ({ ...layout, modules: [layout.modules[0], ...layout.modules.slice(0, 3)] })],
    ["unknown section", (layout: ProfileLayout) => ({ ...layout, modules: [...layout.modules.slice(1), { type: "heatmap", visible: true, size: "full" }] })],
    ["every section hidden", (layout: ProfileLayout) => ({ ...layout, modules: layout.modules.map((module) => ({ ...module, visible: false })) })],
    ["unknown section field", (layout: ProfileLayout) => ({ ...layout, modules: layout.modules.map((module) => ({ ...module, custom: true })) })],
    ["stats on an unrelated section", (layout: ProfileLayout) => ({ ...layout, modules: layout.modules.map((module) => ({ ...module, stats: ["coding_minutes"] })) })],
    ["unsupported size", (layout: ProfileLayout) => ({ ...layout, modules: layout.modules.map((module) => ({ ...module, size: "tiny" })) })],
    ["half-width headline stats", (layout: ProfileLayout) => ({ ...layout, modules: layout.modules.map((module) => ({ ...module, size: "half" })) })],
  ])("rejects %s", (_label, change) => {
    expect(profileLayoutSchema.safeParse(change(getDefaultProfileLayout())).success).toBe(false);
  });

  it.each([undefined, [], ["sessions"], ["lines_added", "lines_added"], [...statIds, "coding_minutes"]])(
    "rejects missing, empty, fabricated, duplicate, or excessive headline stats: %j",
    (stats) => {
      const layout = getDefaultProfileLayout();
      const modules = layout.modules.map((module) => module.type === "stats" ? { ...module, stats } : module);
      expect(profileLayoutSchema.safeParse({ ...layout, modules }).success).toBe(false);
    },
  );

  it("accepts a single visible section, one chosen stat, and every supported size", () => {
    const layout = getDefaultProfileLayout();
    for (const section of layout.modules) {
      section.visible = section.type === "stats";
      if (section.type === "stats") section.stats = ["coding_minutes"];
      for (const size of moduleDefinitions[section.type].sizes) {
        if (section.type === "stats") section.size = "full";
        else section.size = size;
        expect(profileLayoutSchema.safeParse(layout).success).toBe(true);
      }
    }
  });
});

describe("profile layout editing", () => {
  it("moves sections across hidden sections in one step", () => {
    const layout = setModuleVisibility(getDefaultProfileLayout(), "stats", false);
    const moved = moveModule(layout, "code_changes", -1);
    expect(moved.modules.filter((module) => module.visible).map((module) => module.type)).toEqual([
      "code_changes", "links", "languages",
    ]);
    expect(moveModule(moved, "code_changes", 1)).toEqual(layout);
    expect(moveModule(moved, "code_changes", -1)).toEqual(moved);
    expect(moveModule(layout, "languages", 1)).toEqual(layout);
  });

  it("hides and restores sections without duplicate sections or lost settings", () => {
    const layout = setModuleSize(getDefaultProfileLayout(), "languages", "half");
    const hidden = setModuleVisibility(layout, "languages", false);
    const restored = setModuleVisibility(hidden, "languages", true);
    expect(restored).toEqual(layout);
    expect(setModuleVisibility(restored, "languages", true)).toEqual(layout);
  });

  it("does not hide the last visible section", () => {
    let layout = getDefaultProfileLayout();
    for (const section of layout.modules) layout = setModuleVisibility(layout, section.type, false);
    expect(layout.modules.filter((module) => module.visible).map((module) => module.type)).toEqual(["languages"]);
    expect(profileLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("applies supported sizes and keeps headline stats full width", () => {
    const layout = getDefaultProfileLayout();
    expect(setModuleSize(layout, "stats", "half")).toEqual(layout);
    expect(setModuleSize(layout, "code_changes", "half").modules.find((module) => module.type === "code_changes")?.size).toBe("half");
  });

  it("chooses and reorders headline stats, with new selections added at the end", () => {
    const layout = getDefaultProfileLayout();
    const hidden = toggleStat(layout, "lines_added");
    expect(selectedStats(hidden)).not.toContain("lines_added");
    const restored = toggleStat(hidden, "lines_added");
    expect(selectedStats(restored).at(-1)).toBe("lines_added");
    expect(selectedStats(moveStat(restored, "lines_added", -1)).slice(-2)).toEqual(["lines_added", "coding_minutes"]);
    expect(moveStat(restored, "lines_added", 1)).toEqual(restored);
    expect(moveStat(hidden, "lines_added", -1)).toEqual(hidden);
    expect(moveStat(layout, "lines_added", -1)).toEqual(layout);
  });

  it("keeps at least one headline stat selected", () => {
    let layout = getDefaultProfileLayout();
    for (const stat of statIds) layout = toggleStat(layout, stat);
    expect(selectedStats(layout)).toEqual(["coding_minutes"]);
    expect(profileLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("edits frozen layouts without mutating the input or nested stat arrays", () => {
    const layout = getDefaultProfileLayout();
    const before = JSON.stringify(layout);
    Object.freeze(selectedStats(layout));
    layout.modules.forEach(Object.freeze);
    Object.freeze(layout.modules);
    Object.freeze(layout);

    const edits = [
      moveModule(layout, "links", 1),
      moveModuleTo(layout, "links", "languages"),
      setModuleVisibility(layout, "links", false),
      setModuleSize(layout, "languages", "half"),
      toggleStat(layout, "lines_added"),
      moveStat(layout, "lines_added", 1),
    ];
    for (const edited of edits) {
      expect(edited).not.toEqual(layout);
      expect(profileLayoutSchema.safeParse(edited).success).toBe(true);
    }
    expect(JSON.stringify(layout)).toBe(before);
  });
});


describe("drag section ordering", () => {
  const types = ["links", "stats", "code_changes", "languages"] as const;

  it.each(types.flatMap((from) => types.map((to) => ({ from, to }))))("moves $from to $to without swapping intervening sections", ({ from, to }) => {
    const layout = setModuleSize(getDefaultProfileLayout(), "languages", "half");
    const before = structuredClone(layout);
    const expected = [...types];
    expected.splice(types.indexOf(from), 1);
    expected.splice(types.indexOf(to), 0, from);
    const next = moveModuleTo(layout, from, to);
    expect(next.modules.map((module) => module.type)).toEqual(expected);
    for (const section of next.modules) expect(section).toEqual(before.modules.find((row) => row.type === section.type));
    expect(normalizeProfileLayout(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(profileLayoutSchema.safeParse(next).success).toBe(true);
    expect(layout).toEqual(before);
  });

  it("keeps hidden slots and their settings intact during a drag and restore", () => {
    const layout = setModuleVisibility(setModuleSize(getDefaultProfileLayout(), "code_changes", "half"), "code_changes", false);
    const next = moveModuleTo(layout, "languages", "links");
    expect(next.modules.map((module) => module.type)).toEqual(["languages", "links", "code_changes", "stats"]);
    expect(next.modules[2]).toEqual(layout.modules[2]);
    const restored = setModuleVisibility(next, "code_changes", true);
    expect(restored.modules[2]).toEqual({ type: "code_changes", visible: true, size: "half" });
    expect(setModuleVisibility(restored, "code_changes", true)).toEqual(restored);
    expect(profileLayoutSchema.safeParse(restored).success).toBe(true);
  });

  it("ignores hidden drag sources and targets", () => {
    const layout = setModuleVisibility(getDefaultProfileLayout(), "stats", false);
    expect(moveModuleTo(layout, "stats", "links")).toBe(layout);
    expect(moveModuleTo(layout, "links", "stats")).toBe(layout);
    expect(moveModule(layout, "stats", 1)).toBe(layout);
  });

  it("matches the compact arrow fallback for adjacent visible sections", () => {
    const layout = setModuleVisibility(getDefaultProfileLayout(), "stats", false);
    expect(moveModuleTo(layout, "links", "code_changes")).toEqual(moveModule(layout, "links", 1));
    expect(moveModuleTo(layout, "languages", "code_changes")).toEqual(moveModule(layout, "languages", -1));
  });
});
