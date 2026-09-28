import { describe, expect, it } from "vitest";

import {
  buildFingerprint,
  compactLayout,
  FINGERPRINT_HOURS,
  fingerprintDaysFromHourlyRows,
  fingerprintFrame,
  formatFingerprintDate,
  formatUtcHourRange,
  heroLayout,
  hourX,
  nearestRidge,
  REPRESENTATIVE_FROM,
  REPRESENTATIVE_TO,
  representativeFingerprint,
  representativeFingerprintDays,
  ridgeHeights,
  ridgePath,
  stipplePath,
  summarizeFingerprint,
} from "@/lib/activity-fingerprint";

const hours = (fill: (hour: number) => number) => Array.from({ length: FINGERPRINT_HOURS }, (_, hour) => fill(hour));
const numbers = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("activity fingerprint semantics", () => {
  it("keeps missing dates, unavailable hourly data and observed zero distinct", () => {
    const model = buildFingerprint([
      { date: "2026-09-01", hours: hours((hour) => (hour === 9 ? 1_800_000 : 0)) },
      { date: "2026-09-02", hours: null },
      { date: "2026-09-04", hours: hours(() => 0) },
    ]);
    expect(model.ridges.map((ridge) => ridge.status)).toEqual(["observed", "unavailable", "missing", "observed"]);
    expect(model.ridges[2]).toMatchObject({ date: "2026-09-03", values: null, total: null, peakHour: null });
    expect(model.ridges[1]).toMatchObject({ values: null, total: null });
    expect(model.ridges[3]).toMatchObject({ total: 0, peakHour: null });
    expect(model).toMatchObject({ observedDays: 2, unavailableDays: 1, missingDays: 1, zeroDays: 1, maxValue: 1_800_000 });
  });

  it("never draws unavailable or missing ridges as zero-height data", () => {
    const model = buildFingerprint([{ date: "2026-09-01", hours: hours(() => 60_000) }, { date: "2026-09-03", hours: null }]);
    expect(model.ridges.map((ridge) => ridge.status)).toEqual(["observed", "missing", "unavailable"]);
    // Heights exist only for observed values; other states render as distinct marks.
    expect(ridgeHeights(model.ridges[1], model, heroLayout).every((height) => height === 0)).toBe(true);
    expect(summarizeFingerprint(model).total).toBe(24 * 60_000);
  });

  it("uses an explicit window, including leading and trailing dates without records", () => {
    const model = buildFingerprint([{ date: "2026-09-10", hours: hours(() => 1) }], { from: "2026-09-08", to: "2026-09-12" });
    expect(model.ridges.map((ridge) => `${ridge.date}:${ridge.status}`)).toEqual([
      "2026-09-08:missing", "2026-09-09:missing", "2026-09-10:observed", "2026-09-11:missing", "2026-09-12:missing",
    ]);
    expect(model).toMatchObject({ from: "2026-09-08", to: "2026-09-12", missingDays: 4 });
  });

  it("caps ridges to the most recent dates and counts what it omitted", () => {
    const days = Array.from({ length: 40 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, hours: hours(() => index) }))
      .filter((day) => day.date <= "2026-08-31");
    const model = buildFingerprint(days, { maxRidges: 10 });
    expect(model.ridges).toHaveLength(10);
    expect(model.from).toBe("2026-08-22");
    expect(model.omittedDays).toBe(21);
    expect(model.maxValue).toBe(30);
  });

  it("normalizes linearly against the largest observed bin across all dates", () => {
    const model = buildFingerprint([
      { date: "2026-09-01", hours: hours((hour) => (hour === 3 ? 1_000 : 0)) },
      { date: "2026-09-02", hours: hours((hour) => (hour === 3 ? 4_000 : 0)) },
    ]);
    expect(ridgeHeights(model.ridges[0], model, heroLayout)[3]).toBe(heroLayout.amplitude / 4);
    expect(ridgeHeights(model.ridges[1], model, heroLayout)[3]).toBe(heroLayout.amplitude);
  });

  it("handles all-zero history without dividing by zero", () => {
    const model = buildFingerprint([{ date: "2026-09-01", hours: hours(() => 0) }]);
    expect(model.maxValue).toBe(0);
    const frame = fingerprintFrame(model, heroLayout);
    const path = ridgePath(frame, frame.ridges[0], ridgeHeights(model.ridges[0], model, heroLayout));
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(new Set(numbers(path).filter((_, index) => index % 2 === 1))).toEqual(new Set([frame.ridges[0].baseline]));
  });

  it("supports very short history: one day, and an empty window", () => {
    const one = buildFingerprint([{ date: "2026-09-01", hours: hours((hour) => hour * 1000) }]);
    const frame = fingerprintFrame(one, heroLayout);
    expect(one.ridges).toHaveLength(1);
    expect(frame.ridges[0].baseline).toBe(heroLayout.height - heroLayout.padBottom);
    expect(buildFingerprint([])).toMatchObject({ ridges: [], observedDays: 0, maxValue: 0 });
  });

  it.each([
    [[{ date: "2026-02-30", hours: null }], /Invalid fingerprint date/],
    [[{ date: "2026-09-01", hours: null }, { date: "2026-09-01", hours: null }], /Duplicate/],
    [[{ date: "2026-09-01", hours: [1, 2, 3] }], /24 finite non-negative/],
    [[{ date: "2026-09-01", hours: hours((hour) => (hour ? 0 : -1)) }], /24 finite non-negative/],
    [[{ date: "2026-09-01", hours: hours(() => Number.NaN) }], /24 finite non-negative/],
  ])("rejects malformed input instead of repairing it (%#)", (days, message) => {
    expect(() => buildFingerprint(days)).toThrow(message);
  });

  it("labels hours in UTC and dates from the UTC calendar, independent of locale", () => {
    expect(formatUtcHourRange(0)).toBe("00:00–01:00 UTC");
    expect(formatUtcHourRange(23)).toBe("23:00–24:00 UTC");
    expect(formatFingerprintDate("2026-09-01")).toBe("Sep 1");
    expect(buildFingerprint([{ date: "2026-08-31", hours: null }]).ridges[0].weekday).toBe(1);
  });

  it("maps private hourly rows by explicit measure and keeps null history null", () => {
    const row = { activeMsByHour: hours(() => 1), editCountByHour: hours(() => 2), linesAddedByHour: hours(() => 3), linesRemovedByHour: hours(() => 4) };
    expect(fingerprintDaysFromHourlyRows([{ date: "2026-09-01", hourlyUtc: row }, { date: "2026-09-02", hourlyUtc: null }], "editCount"))
      .toEqual([{ date: "2026-09-01", hours: row.editCountByHour }, { date: "2026-09-02", hours: null }]);
  });
});

describe("activity fingerprint geometry", () => {
  const model = representativeFingerprint();
  const frame = fingerprintFrame(model, heroLayout);

  it("is deterministic and serialized at fixed precision", () => {
    const first = model.ridges.map((ridge, index) => ridgePath(frame, frame.ridges[index], ridgeHeights(ridge, model, heroLayout)));
    const again = representativeFingerprint().ridges.map((ridge, index) => ridgePath(frame, frame.ridges[index], ridgeHeights(ridge, model, heroLayout)));
    expect(again).toEqual(first);
    for (const path of first) expect(path).toMatch(/^M[-\d.,]+ L[-\d.,]+( C[-\d.,]+ [-\d.,]+ [-\d.,]+)+ L[-\d.,]+$/);
    for (const value of first.flatMap(numbers)) expect(Math.round(value * 100) / 100).toBe(value);
  });

  it("passes through every bin centre without overshooting or dipping below the baseline", () => {
    model.ridges.forEach((ridge, index) => {
      if (ridge.status !== "observed") return;
      const ridgeFrame = frame.ridges[index];
      const heights = ridgeHeights(ridge, model, heroLayout);
      const path = ridgePath(frame, ridgeFrame, heights);
      const ys = numbers(path).filter((_, position) => position % 2 === 1);
      expect(Math.max(...ys)).toBeLessThanOrEqual(ridgeFrame.baseline + 0.005); // 2-decimal serialization
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(ridgeFrame.baseline - Math.max(...heights) - 0.01);
      heights.forEach((height, hour) => {
        expect(path).toContain(`${Math.round(hourX(frame, ridgeFrame, hour + 0.5) * 100) / 100},${Math.round((ridgeFrame.baseline - height) * 100) / 100}`);
      });
    });
  });

  it("orders depth oldest-at-back, newest-at-front, within the viewBox", () => {
    expect(frame.ridges[0].baseline).toBeLessThan(frame.ridges.at(-1)!.baseline);
    expect(frame.ridges[0].left).toBeGreaterThan(frame.ridges.at(-1)!.left);
    for (const ridge of frame.ridges) {
      expect(ridge.left - heroLayout.tail).toBeGreaterThanOrEqual(0);
      expect(ridge.right + heroLayout.tail).toBeLessThanOrEqual(heroLayout.width);
    }
    const compact = fingerprintFrame(model, compactLayout);
    expect(compact.ridges.at(-1)!.baseline).toBe(compactLayout.height - compactLayout.padBottom);
  });

  it("keeps an interaction skew centred on the resting footprint", () => {
    const skewed = fingerprintFrame(model, heroLayout, 1.2);
    const centre = (value: typeof frame) => (value.ridges[0].right + value.ridges.at(-1)!.left) / 2;
    expect(centre(skewed)).toBeCloseTo(centre(frame), 6);
  });

  it("stipples exact bin heights, quantized, under the line only", () => {
    const busiest = model.ridges.indexOf(summarizeFingerprint(model).busiestDay!);
    const heights = ridgeHeights(model.ridges[busiest], model, heroLayout);
    const path = stipplePath(frame, frame.ridges[busiest], heights);
    const dots = path.match(/h0/g)!.length;
    expect(dots).toBe(heights.reduce((sum, height) => sum + 2 * Math.max(0, Math.floor((height - 2) / 5)), 0));
    expect(stipplePath(frame, frame.ridges[busiest], heights.map(() => 0))).toBe("");
  });

  it("finds the nearest ridge and UTC hour for a pointer position", () => {
    const busiest = model.ridges.indexOf(summarizeFingerprint(model).busiestDay!);
    const ridgeFrame = frame.ridges[busiest];
    const heights = ridgeHeights(model.ridges[busiest], model, heroLayout);
    const peak = model.ridges[busiest].peakHour!;
    expect(nearestRidge(model, frame, hourX(frame, ridgeFrame, peak + 0.5), ridgeFrame.baseline - heights[peak])).toEqual({ ridge: busiest, hour: peak });
    expect(nearestRidge(model, frame, -500, 10)).toBeNull();
  });
});

describe("representative example dataset", () => {
  it("is a fixed, integer, clearly bounded 30-day example", () => {
    const days = representativeFingerprintDays();
    expect(representativeFingerprintDays()).toEqual(days);
    const model = representativeFingerprint();
    expect(model).toMatchObject({ from: REPRESENTATIVE_FROM, to: REPRESENTATIVE_TO, observedDays: 28, missingDays: 2, unavailableDays: 0, zeroDays: 1 });
    expect(model.ridges).toHaveLength(30);
    for (const day of days) for (const value of day.hours!) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(3_600_000);
    }
  });

  it("derives summary statistics only from observed ridges", () => {
    const model = representativeFingerprint();
    const summary = summarizeFingerprint(model);
    expect(summary.total).toBe(model.ridges.reduce((sum, ridge) => sum + (ridge.total ?? 0), 0));
    expect(summary.hourTotals).toHaveLength(24);
    expect(summary.busiestDay!.total).toBe(Math.max(...model.ridges.map((ridge) => ridge.total ?? 0)));
    expect(summary.busiestHour).toBe(summary.hourTotals.indexOf(Math.max(...summary.hourTotals)));
  });
});
