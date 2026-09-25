import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProfileSectionPicker } from "@/components/profile/profile-section-picker";
import { getDefaultProfileLayout, moduleDefinitions, normalizeProfileLayout, setModuleVisibility } from "@/lib/profile-layout";

function renderPicker(modules = getDefaultProfileLayout().modules) {
  return renderToStaticMarkup(<ProfileSectionPicker modules={modules} onChoose={() => {}} onClose={() => {}} />);
}

describe("profile section catalog", () => {
  it("offers no duplicates when all sections are already visible", () => {
    const html = renderPicker();
    expect(html).toContain("All available sections are already on your profile.");
    expect(html).not.toMatch(/aria-label="Add /);
    expect(html).toContain('aria-label="Close section picker"');
  });

  it("offers every hidden type with its catalog label, description and icon", () => {
    const layout = getDefaultProfileLayout();
    for (const section of layout.modules) {
      const hidden = setModuleVisibility(layout, section.type, false);
      const html = renderPicker(hidden.modules);
      const definition = moduleDefinitions[section.type];
      expect(html).toContain(`aria-label="Add ${definition.label}"`);
      expect(html).toContain(definition.description);
      expect(html).toContain('<svg');
      expect(html.match(/aria-label="Add /g)).toHaveLength(1);
      expect(renderPicker(setModuleVisibility(hidden, section.type, true).modules)).not.toMatch(/aria-label="Add /);
    }
  });

  it("offers omitted sections recovered from an older saved layout only once", () => {
    const layout = normalizeProfileLayout({ version: 1, modules: [
      { type: "stats", visible: true, size: "full", stats: ["coding_minutes"] },
      { type: "stats", visible: true, size: "full", stats: ["lines_added"] },
    ] });
    const html = renderPicker(layout.modules);
    expect(html.match(/aria-label="Add /g)).toHaveLength(3);
    expect(html).not.toContain('aria-label="Add Headline stats"');
  });

  it("prevents adding a section while the current draft is saving", () => {
    const layout = setModuleVisibility(getDefaultProfileLayout(), "languages", false);
    const html = renderToStaticMarkup(<ProfileSectionPicker modules={layout.modules} disabled onChoose={() => {}} onClose={() => {}} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Add Languages"/);
  });
});
