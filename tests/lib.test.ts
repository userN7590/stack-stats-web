import { describe, expect, it } from "vitest";

import { backgroundStyles, displayFonts } from "../src/lib/appearance";
import {
  formatCodingTime,
  formatDate,
  formatNumber,
  getHostname,
  getInitials,
} from "../src/lib/format";
import { appearanceSchema, profileSchema } from "../src/lib/validation";

const validProfileInput = {
  username: "fil",
  displayName: "Fil Stop",
  bio: "Building useful software.",
  avatarUrl: "https://example.com/avatar.png",
  githubUrl: "https://github.com/fil",
  websiteUrl: "https://example.com",
  linesAdded: 12500,
  linesRemoved: 3200,
  filesChanged: 240,
  editEvents: 850,
  projectsCount: 12,
  codingMinutes: 3725,
  languages: [
    { rowId: "typescript", name: "TypeScript", percentage: 70 },
    { rowId: "python", name: "Python", percentage: 30 },
  ],
};

describe("profileSchema", () => {
  it("accepts a valid profile with a 100% language distribution", () => {
    const result = profileSchema.safeParse(validProfileInput);

    expect(result.success).toBe(true);
  });

  it.each([
    ["too short", "ab"],
    ["starts with punctuation", "_fil"],
    ["contains unsupported punctuation", "fil.dev"],
    ["contains spaces", "fil stop"],
  ])("rejects a username that is %s", (_description, username) => {
    expect(
      profileSchema.safeParse({ ...validProfileInput, username }).success,
    ).toBe(false);
  });

  it("normalizes uppercase usernames to lowercase", () => {
    const result = profileSchema.safeParse({
      ...validProfileInput,
      username: "Fil",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("fil");
    }
  });

  it.each([
    "linesAdded",
    "linesRemoved",
    "filesChanged",
    "editEvents",
    "projectsCount",
    "codingMinutes",
  ])("rejects a negative %s aggregate", (field) => {
    expect(
      profileSchema.safeParse({
        ...validProfileInput,
        [field]: -1,
      }).success,
    ).toBe(false);
  });

  it.each([0, 100.01])(
    "rejects an individually invalid language percentage of %s",
    (percentage) => {
      const result = profileSchema.safeParse({
        ...validProfileInput,
        languages: [
          { rowId: "typescript", name: "TypeScript", percentage },
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.path.join(".") === "languages.0.percentage",
          ),
        ).toBe(true);
      }
    },
  );

  it("requires supplied language percentages to total 100", () => {
    const result = profileSchema.safeParse({
      ...validProfileInput,
      languages: [
        { rowId: "typescript", name: "TypeScript", percentage: 60 },
        { rowId: "python", name: "Python", percentage: 30 },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path.join(".") === "languages",
        ),
      ).toBe(true);
    }
  });

  it("rejects duplicate language names without regard to case", () => {
    expect(
      profileSchema.safeParse({
        ...validProfileInput,
        languages: [
          { rowId: "typescript-1", name: "TypeScript", percentage: 50 },
          { rowId: "typescript-2", name: "typescript", percentage: 50 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("appearanceSchema", () => {
  it("accepts every curated display-font preset", () => {
    for (const option of displayFonts) {
      expect(
        appearanceSchema.safeParse({
          displayFont: option.value,
          backgroundStyle: "none",
        }).success,
      ).toBe(true);
    }
  });

  it("accepts every curated background preset", () => {
    for (const option of backgroundStyles) {
      expect(
        appearanceSchema.safeParse({
          displayFont: "editorial",
          backgroundStyle: option.value,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an unsupported display font", () => {
    expect(
      appearanceSchema.safeParse({
        displayFont: "custom-font",
        backgroundStyle: "none",
      }).success,
    ).toBe(false);
  });

  it("rejects an unsupported background style", () => {
    expect(
      appearanceSchema.safeParse({
        displayFont: "editorial",
        backgroundStyle: "animated-rainbow",
      }).success,
    ).toBe(false);
  });
});

describe("formatting utilities", () => {
  it.each([
    [0, "0m"],
    [37, "37m"],
    [60, "1h"],
    [125, "2h 5m"],
    [60060, "1,001h"],
  ])("formats %s coding minutes as %s", (minutes, expected) => {
    expect(formatCodingTime(minutes)).toBe(expected);
  });

  it("formats large numbers for display", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it.each([
    ["Ada Lovelace", "AL"],
    ["  Fil   Stop  ", "FS"],
    ["Prince", "P"],
    ["", "SS"],
  ])("creates initials for %j", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });

  it("extracts a hostname and removes a leading www", () => {
    expect(getHostname("https://www.example.com/work")).toBe("example.com");
  });

  it("returns invalid URL text unchanged", () => {
    expect(getHostname("not a url")).toBe("not a url");
  });

  it("formats valid UTC dates and handles invalid dates", () => {
    expect(formatDate("2026-08-27T00:00:00.000Z")).toBe("Aug 27, 2026");
    expect(formatDate("invalid")).toBe("Unknown");
  });
});
