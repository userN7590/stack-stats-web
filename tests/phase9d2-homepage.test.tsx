import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

import { ExtensionCta } from "@/components/home/extension-cta";
import { HomeView } from "@/components/home/home-view";
import { GridPulse } from "@/components/ui/structure";
import { cardBands, pickCardBand } from "@/lib/card-stack";
import { extensionInstallUrl, VSCODE_EXTENSION_URL } from "@/lib/distribution";
import { exampleProfile } from "@/lib/example-profile";

afterEach(() => vi.restoreAllMocks());
const view = (signedIn = false) => renderToStaticMarkup(<HomeView viewer={{ signedIn, username: signedIn ? "dev" : null }} example={{ profile: exampleProfile, live: false }} />);

describe("card fan selection", () => {
  const bands = cardBands([0, 120, 240, 360], 650);

  it("gives every card a contiguous resting band", () => {
    expect(bands).toEqual([{ start: 0, end: 120 }, { start: 120, end: 240 }, { start: 240, end: 360 }, { start: 360, end: 650 }]);
    expect(bands.slice(0, 3).every((band) => band.end - band.start === 120)).toBe(true);
  });

  it("selects by band, keeps the current card within the hysteresis margin, then switches", () => {
    expect(pickCardBand(bands, 60, null, 18)).toBe(0);
    expect(pickCardBand(bands, 130, 0, 18)).toBe(0); // 10px past the edge: still card 0.
    expect(pickCardBand(bands, 139, 0, 18)).toBe(1); // Clearly inside card 1.
    expect(pickCardBand(bands, 110, 1, 18)).toBe(1); // And back within its margin.
    expect(pickCardBand(bands, 500, 1, 18)).toBe(3);
  });

  it("never oscillates on jitter around a boundary", () => {
    let current: number | null = 1, switches = 0;
    for (let step = 0; step < 60; step++) {
      const next = pickCardBand(bands, 240 + ((step * 7) % 25) - 12, current, 18);
      if (next !== current) switches++;
      current = next;
    }
    expect(switches).toBe(0);
  });

  it("keeps the nearest card reachable beyond either end", () => {
    expect(pickCardBand(bands, -40, null, 18)).toBe(0);
    expect(pickCardBand(bands, 900, null, 18)).toBe(3);
    expect(pickCardBand([], 10, null, 18)).toBeNull();
  });
});

describe("VS Code extension entry point", () => {
  it("has no public install URL yet, so no link is rendered", () => {
    expect(VSCODE_EXTENSION_URL).toBeNull();
    const html = renderToStaticMarkup(<ExtensionCta />);
    expect(html).toContain('data-extension-cta="coming-soon"');
    expect(html).toContain("Coming soon");
    expect(html).toContain("Track locally. Connect your account later.");
    expect(html).not.toMatch(/<a\b|href=/);
    expect(html).toMatch(/<svg aria-hidden="true" focusable="false"[^>]*class="ext-cta-mark"/);
  });

  it("accepts only an official HTTPS listing", () => {
    expect(extensionInstallUrl(null)).toBeNull();
    for (const invalid of ["", "#", "https://example.com/stack-stats", "http://marketplace.visualstudio.com/items?itemName=a.b", "https://marketplace.visualstudio.com/", "javascript:alert(1)", "not a url"]) {
      expect(extensionInstallUrl(invalid), invalid).toBeNull();
    }
    expect(extensionInstallUrl("https://marketplace.visualstudio.com/items?itemName=stackstats.stack-stats-vscode")).toBe("https://marketplace.visualstudio.com/items?itemName=stackstats.stack-stats-vscode");
    expect(extensionInstallUrl("https://open-vsx.org/extension/stackstats/stack-stats-vscode")).toBe("https://open-vsx.org/extension/stackstats/stack-stats-vscode");
  });

  it("becomes an active link once an official listing is configured", () => {
    const html = renderToStaticMarkup(<ExtensionCta url="https://marketplace.visualstudio.com/items?itemName=stackstats.stack-stats-vscode" />);
    expect(html).toMatch(/<a href="https:\/\/marketplace\.visualstudio\.com\/items\?itemName=stackstats\.stack-stats-vscode" target="_blank" rel="noopener noreferrer" class="ext-cta" data-extension-cta="available">/);
    expect(html).toContain("Get the VS Code extension");
    expect(html).toContain("Start tracking now. Connect your account later.");
    expect(html).toContain("(opens the extension listing in a new tab)");
  });

  it("sits beside the primary profile action in the hero and the final call to action", () => {
    for (const signedIn of [false, true]) {
      const actions = view(signedIn).match(/<div class="hero-actions">[\s\S]*?data-extension-cta="coming-soon"/g)!;
      expect(actions).toHaveLength(2);
      for (const block of actions) expect(block).toMatch(signedIn ? /href="\/u\/dev"[^>]*>View \/u\/dev/ : /href="\/signup"[^>]*>Create your profile/);
    }
  });
});

describe("four-card composition", () => {
  it("renders the live card first in reading order but front-right in the fan", () => {
    const html = view();
    const cards = html.match(/<li class="pcard[^"]*" style="[^"]*" data-profile-card="[^"]+" data-card-pos="\d"/g)!;
    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatch(/class="pcard pcard-front" style="--pos:3;--y:0;--r:-1.2deg;--z:5"/);
    expect(cards.slice(1).map((card) => card.match(/data-profile-card="([^"]+)"/)![1])).toEqual(["nightowl", "weekends", "sprints"]);
    expect(cards.slice(1).map((card) => card.match(/data-card-pos="(\d)"/)![1])).toEqual(["0", "1", "2"]);
    expect(html).toMatch(/<ul class="pcards" aria-label="Developer profile cards" style="--n:4;--step-ratio:0.47;--front-scale:1.1;--ymax:3.3">/);
  });

  it("renders deterministically without randomness", () => {
    const random = vi.spyOn(Math, "random");
    expect(view()).toBe(view());
    expect(random).not.toHaveBeenCalled();
  });
});

describe("structural grid signal", () => {
  it("places a few deterministic ambient pulses, hidden from assistive technology", () => {
    expect(renderToStaticMarkup(<GridPulse edge="left" delay={3} />)).toBe('<span aria-hidden="true" class="grid-pulse grid-pulse-left" style="--pulse-delay:3s"></span>');
    const pulses = view().match(/<span aria-hidden="true" class="grid-pulse [^"]+" style="--pulse-delay:\d+s"><\/span>/g)!;
    expect(pulses).toEqual([
      '<span aria-hidden="true" class="grid-pulse grid-pulse-left" style="--pulse-delay:3s"></span>',
      '<span aria-hidden="true" class="grid-pulse grid-pulse-rule" style="--pulse-delay:11s"></span>',
      '<span aria-hidden="true" class="grid-pulse grid-pulse-right" style="--pulse-delay:19s"></span>',
    ]);
  });

  it("animates pulses only without reduced motion and keeps proximity strips hidden by default", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/g, "");
    expect(outside).not.toMatch(/animation:\s*grid-pulse/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\n  \.grid-pulse-left::before, \.grid-pulse-right::before \{ animation: grid-pulse-y/);
    expect(css).toMatch(/\.site-guides > span::after, \.site-section::after, \.grid-rule::after \{\n  content: ""; position: absolute; pointer-events: none; opacity: 0;/);
    expect(css).toContain(".grid-near::before, .grid-near::after, .site-guides.grid-near > span::after { opacity: 1; }");
  });

  it("keeps pointer work out of React and coalesced to animation frames", () => {
    for (const path of ["src/components/ui/grid-signal.tsx", "src/components/home/card-stack.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(/useState|useReducer|setState/);
      expect(source, path).toMatch(/requestAnimationFrame\(update\)/);
      expect(source, path).not.toContain("Math.random");
    }
    const grid = readFileSync("src/components/ui/grid-signal.tsx", "utf8");
    expect(grid).toContain('"(hover: hover) and (pointer: fine)"');
    expect(grid).toContain('"(prefers-reduced-motion: reduce)"');
    expect(grid).toMatch(/event\.pointerType !== "mouse" && event\.pointerType !== "pen"/);
  });
});
