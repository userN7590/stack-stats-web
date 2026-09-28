import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Annotated, Crosshair, SketchArrow, SketchBrace, SketchNodeLoop, SketchUnderline } from "@/components/annotations/sketch";
import { ActivityFingerprint, depthInk, describeFingerprint, describeSelection } from "@/components/fingerprint/activity-fingerprint";
import { buildFingerprint, FINGERPRINT_HOURS, representativeFingerprint } from "@/lib/activity-fingerprint";
import { loadOwnerFingerprint, OWNER_FINGERPRINT_URL } from "@/lib/owner-fingerprint";

const hours = (fill: (hour: number) => number) => Array.from({ length: FINGERPRINT_HOURS }, (_, hour) => fill(hour));
const mixed = buildFingerprint([
  { date: "2026-09-01", hours: hours((hour) => (hour > 8 && hour < 18 ? 1_800_000 : 0)) },
  { date: "2026-09-02", hours: null },
  { date: "2026-09-04", hours: hours(() => 0) },
]);
const render = (model = mixed) => renderToStaticMarkup(<ActivityFingerprint model={model} title="Activity fingerprint" label="30 days of coding · example data" />);

afterEach(() => vi.restoreAllMocks());

describe("activity fingerprint component", () => {
  it("renders identical deterministic markup on every render (hydration-safe)", () => {
    const random = vi.spyOn(Math, "random");
    const first = render(representativeFingerprint());
    expect(render(representativeFingerprint())).toBe(first);
    expect(random).not.toHaveBeenCalled();
    expect(first).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("keeps a short visible caption and an equivalent accessible table", () => {
    const html = render();
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-labelledby=/);
    expect(html).toContain("<title");
    expect(html).toContain(describeFingerprint(mixed, "calendar"));
    expect(html).toMatch(/aria-live="polite"[^>]*>30 days of coding · example data<\/p>/);
    expect(html).toMatch(/role="group"[^>]*aria-label="Activity fingerprint\. Explore with arrow keys/);
    // No visible legend, source essay or values disclosure; data stays available to assistive technology.
    expect(html).not.toMatch(/<details|RIDGE = |Values by date|Highlighted:/);
    const table = html.slice(html.indexOf('<div class="sr-only">'));
    for (const text of ["<table>", "Observed zero", "Hourly data unavailable", "No record", "09:00–10:00 UTC"]) expect(table).toContain(text);
  });

  it("renders no cursor line; the resting accent lives inside its own ridge group", () => {
    const html = render(representativeFingerprint());
    expect(html).not.toMatch(/data-cursor|fp-cursor/);
    // The rest accent (local blue line + stipple) is painted inside the busiest ridge's group,
    // so ridges in front of it occlude it like any other part of that ridge.
    const group = html.match(/<g data-group="9"[\s\S]*?<\/g>/)![0];
    expect(group).toMatch(/data-ridge="9"[^>]*class="fp-observed is-rest"/);
    expect(group).toMatch(/class="fp-accent-line fp-rest-hl"[^>]*stroke="url\(#[\w-]+-rest\)"/);
    expect(group).toContain("fp-stipple fp-rest-hl");
    expect(html.match(/fp-rest-hl/g)).toHaveLength(2);
    // Blue is a local gradient window around the peak hour, not a whole-ridge colour.
    expect(html).toMatch(/<linearGradient id="[\w-]+-rest" gradientUnits="userSpaceOnUse" x1="[\d.]+" x2="[\d.]+"/);
    expect(html).toContain("data-live-gradient");
    expect(html).not.toContain("is-accent");
  });

  it("describes selections without turning missing or unavailable data into zero", () => {
    expect(describeSelection(mixed, { ridge: 0, hour: 9 }, "calendar")).toBe("Tuesday · Sep 1 — 09:00–10:00 UTC — 30m coding time");
    expect(describeSelection(mixed, { ridge: 1, hour: 9 }, "calendar")).toMatch(/unavailable, not zero/);
    expect(describeSelection(mixed, { ridge: 2, hour: 9 }, "calendar")).toMatch(/no record for this date \(not measured zero\)/);
    expect(describeSelection(mixed, { ridge: 3, hour: 9 }, "relative")).toBe("Friday · day 04 — 09:00–10:00 UTC — 0s coding time");
  });

  it("shades depth with deterministic integer colours", () => {
    expect(depthInk(0, 30)).toBe("#33322c");
    expect(depthInk(29, 30)).toBe("#d4d0c4");
    expect(depthInk(0, 1)).toBe("#d4d0c4");
  });

  it("keeps entrance motion and draw-in behind prefers-reduced-motion: no-preference", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const motionBlocks = css.split("@media (prefers-reduced-motion: no-preference)").slice(1).map((block) => block.split("\n}\n")[0]);
    expect(motionBlocks.some((block) => block.includes(".fp-rise .fp-ridge-group"))).toBe(true);
    expect(motionBlocks.some((block) => block.includes(".sketch-draw-load path"))).toBe(true);
    const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/g, "");
    expect(outside).not.toMatch(/animation:\s*(fp-rise|sketch-draw)/);
  });

});

describe("annotation primitives", () => {
  const marks = [
    <SketchBrace key="l" side="left" />, <SketchBrace key="r" side="right" />, <SketchNodeLoop key="loop" />,
    <SketchUnderline key="u" tone="pencil" draw="view" />, <SketchArrow key="a" />, <SketchArrow key="d" direction="down" draw="none" />,
  ];

  it("is decorative, deterministic and outside the accessibility tree", () => {
    for (const mark of marks) {
      const html = renderToStaticMarkup(mark);
      expect(html).toMatch(/^<svg aria-hidden="true" focusable="false"/);
      expect(renderToStaticMarkup(mark)).toBe(html);
      expect(html).not.toMatch(/<text|<title/);
      for (const path of html.match(/<path[^>]*>/g)!) expect(path).toContain('pathLength="1"');
    }
    expect(renderToStaticMarkup(<Crosshair />)).toMatch(/^<svg aria-hidden="true" focusable="false"/);
  });

  it("selects tone and draw behaviour by class only, and stretches underlines to the word", () => {
    expect(renderToStaticMarkup(<SketchUnderline tone="pencil" draw="view" />)).toMatch(/preserveAspectRatio="none"[^>]*class="sketch sketch-pencil sketch-draw-view/);
    expect(renderToStaticMarkup(<SketchArrow draw="none" delay={200} />)).toMatch(/class="sketch sketch-pen sketch-draw-none[^"]*" style="--sketch-delay:200ms"/);
  });

  it("wraps words without adding readable text", () => {
    const html = renderToStaticMarkup(<h1>Your <Annotated marks={<SketchNodeLoop />}>profile</Annotated>.</h1>);
    expect(html.replace(/<[^>]+>/g, "")).toBe("Your profile.");
    expect(html).toContain('class="sketch-anchor "');
  });
});

describe("owner-only fingerprint loading", () => {
  const coverage = { source: "sessions-v1", dateBasis: "collector-local", historyCompleteness: "unknown", partial: true, recordCount: 2, v1Records: 0, v2Records: 2,
    firstUploadedDate: "2026-09-27", lastUploadedDate: "2026-09-28", uploadedDates: 2, firstObservedDate: "2026-09-27", lastObservedDate: "2026-09-28", earliestUploadFromDate: "2026-06-30", latestUploadFromDate: "2026-06-30", hourlyRecords: 1, hourlyDates: 1, frozenHourlyRecords: 0, lateInputIgnoredRecords: 0 };
  const hourly = { source: "telemetry-v2", dateBasis: "UTC", activeMsByHour: hours((hour) => hour * 1000), editCountByHour: hours(() => 1), linesAddedByHour: hours(() => 0), linesRemovedByHour: hours(() => 0) };
  const payload = (rows: unknown[]) => ({ schemaVersion: "2", dataset: "hourlyUtc", from: "2026-09-25", to: "2026-09-28", dateBasis: "UTC", coverage, rows });
  const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

  it("requests only the existing owner endpoint, uncached, with same-origin credentials", async () => {
    const fetcher = respond(200, payload([{ date: "2026-09-27", hourlyUtc: hourly, coverage }, { date: "2026-09-28", hourlyUtc: null, coverage }]));
    const result = await loadOwnerFingerprint(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(OWNER_FINGERPRINT_URL, expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
    expect(OWNER_FINGERPRINT_URL).toBe("/api/v2/sync/datasets?dataset=hourlyUtc&period=30");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.model.ridges.map((ridge) => ridge.status)).toEqual(["missing", "missing", "observed", "unavailable"]);
    expect(result.model.maxValue).toBe(23_000);
  });

  it("reports empty history separately from errors", async () => {
    expect((await loadOwnerFingerprint(respond(200, payload([{ date: "2026-09-28", hourlyUtc: null, coverage }])))).status).toBe("empty");
  });

  it.each([
    [401, "signed-out"], [403, "not-permitted"], [413, "unavailable"], [503, "unavailable"],
  ])("maps HTTP %i to %s without exposing details", async (status, expected) => {
    expect(await loadOwnerFingerprint(respond(status, { error: "x" }))).toEqual({ status: expected });
  });

  it("rejects malformed payloads and network failures", async () => {
    expect(await loadOwnerFingerprint(respond(200, { schemaVersion: "2", dataset: "daily" }))).toEqual({ status: "unavailable" });
    expect(await loadOwnerFingerprint(vi.fn(async () => { throw new TypeError("offline"); }))).toEqual({ status: "unavailable" });
  });
});
