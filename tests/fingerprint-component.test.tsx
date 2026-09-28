import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Annotated, Crosshair, SketchArrow, SketchBrace, SketchNodeLoop, SketchUnderline } from "@/components/annotations/sketch";
import { ActivityFingerprint, depthInk, describeFingerprint, describeSelection } from "@/components/fingerprint/activity-fingerprint";
import { FingerprintMatrix, matrixLevel } from "@/components/fingerprint/fingerprint-matrix";
import { buildFingerprint, FINGERPRINT_HOURS, representativeFingerprint } from "@/lib/activity-fingerprint";
import { loadOwnerFingerprint, OWNER_FINGERPRINT_URL } from "@/lib/owner-fingerprint";

const hours = (fill: (hour: number) => number) => Array.from({ length: FINGERPRINT_HOURS }, (_, hour) => fill(hour));
const mixed = buildFingerprint([
  { date: "2026-09-01", hours: hours((hour) => (hour > 8 && hour < 18 ? 1_800_000 : 0)) },
  { date: "2026-09-02", hours: null },
  { date: "2026-09-04", hours: hours(() => 0) },
]);
const render = (model = mixed) => renderToStaticMarkup(<ActivityFingerprint model={model} title="Activity fingerprint" sourceNote="Representative example data." />);

afterEach(() => vi.restoreAllMocks());

describe("activity fingerprint component", () => {
  it("renders identical deterministic markup on every render (hydration-safe)", () => {
    const random = vi.spyOn(Math, "random");
    const first = render(representativeFingerprint());
    expect(render(representativeFingerprint())).toBe(first);
    expect(random).not.toHaveBeenCalled();
    expect(first).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("exposes an accessible name, description, readout and exact values table", () => {
    const html = render();
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-labelledby=/);
    expect(html).toContain("<title");
    expect(html).toContain(describeFingerprint(mixed, "calendar").replace(/–/g, "–"));
    expect(html).toMatch(/aria-live="polite"/);
    expect(html).toMatch(/role="group"[^>]*aria-label="Activity fingerprint\. Explore with arrow keys/);
    expect(html).toContain("<details");
    expect(html).toContain("Observed zero");
    expect(html).toContain("Hourly data unavailable");
    expect(html).toContain("No record");
    expect(html).toContain("09:00–10:00 UTC");
  });

  it("draws observed, unavailable and missing dates as distinct marks", () => {
    const html = render();
    expect(html.match(/data-status="observed"/g)).toHaveLength(2);
    expect(html).toMatch(/data-status="unavailable"[^>]*class="fp-unavailable"/);
    expect(html).toMatch(/data-status="missing"[^>]*class="fp-missing"/);
    // Only the highlighted observed ridge receives the stipple layer.
    expect(html.match(/data-stipple/g)).toHaveLength(1);
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

  it("renders the readable matrix with levels, zero markers and no-record rows", () => {
    const html = renderToStaticMarkup(<FingerprintMatrix model={mixed} title="Matrix" />);
    expect(html).toMatch(/role="img"[^>]*aria-label="Matrix\. 2 dates with hourly observations, 1 without a record, 1 without hourly data\. Busiest hour overall 09:00–10:00 UTC\."/);
    expect(html).toContain("no record");
    expect(html).toContain('class="fp-matrix-zero"');
    expect(matrixLevel(0, 10)).toBe(0);
    expect(matrixLevel(1, 10)).toBe(1);
    expect(matrixLevel(10, 10)).toBe(5);
    expect(matrixLevel(5, 0)).toBe(0);
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
