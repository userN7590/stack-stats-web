import { buildFingerprint, summarizeFingerprint, synthesizeFingerprintDays, type FingerprintModel } from "@/lib/activity-fingerprint";

/**
 * Fictional example developers for homepage profile cards. Archetype names,
 * `example-` handles and an “Example” tag keep them from reading as real
 * Stack Stats users. Every statistic is derived from each example's own
 * synthetic two-week fingerprint; nothing is invented separately.
 */
export type ExampleDeveloper = {
  key: string;
  name: string;
  username: string;
  bio: string;
  tone: string;
  languages: readonly { name: string; percentage: number }[];
  fingerprint: FingerprintModel;
  codingMs: number;
  activeDates: number;
  peakHour: number | null;
};

const FROM = "2026-09-16", TO = "2026-09-29";
// Minutes per UTC hour.
const night = [34, 22, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 10, 12, 10, 14, 24, 36, 48, 54, 50, 44];
const early = [0, 0, 0, 0, 0, 8, 28, 46, 54, 52, 40, 20, 8, 16, 22, 14, 6, 0, 0, 0, 0, 0, 0, 0];
const evening = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 18, 30, 24, 8, 0];
const saturday = [0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 30, 46, 52, 44, 36, 30, 22, 10, 4, 0, 0, 0, 0, 0];
const burstsA = [0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 10, 0, 0, 46, 6, 0, 0, 52, 4, 0, 0, 0, 0, 0];
const burstsB = [0, 0, 0, 0, 0, 0, 0, 0, 44, 6, 0, 0, 38, 0, 0, 54, 8, 0, 0, 0, 30, 0, 0, 0];

const plans = [
  { key: "nightowl", name: "Night Owl", username: "example-nightowl", bio: "Systems code after dark, mostly in Rust.", tone: "#a58bd4", seed: 11,
    languages: [{ name: "Rust", percentage: 58 }, { name: "Go", percentage: 27 }, { name: "Shell", percentage: 15 }],
    days: [night, night, night, "missing", night, night, night, night, night, "missing", night, night, night, night] },
  { key: "earlybird", name: "Early Bird", username: "example-earlybird", bio: "Front-end work before the first meeting.", tone: "#65c58f", seed: 23,
    languages: [{ name: "TypeScript", percentage: 64 }, { name: "CSS", percentage: 22 }, { name: "Markdown", percentage: 14 }],
    days: [early, early, early, "missing", "missing", early, early, early, early, early, "missing", "missing", early, early] },
  { key: "weekends", name: "Weekend Builder", username: "example-weekends", bio: "Side projects on Saturdays, fixes on weeknights.", tone: "#d8aa54", seed: 37,
    languages: [{ name: "Swift", percentage: 49 }, { name: "Python", percentage: 38 }, { name: "SQL", percentage: 13 }],
    days: [evening, "missing", evening, saturday, saturday, "missing", evening, evening, "missing", evening, saturday, saturday, evening, "missing"] },
  { key: "sprints", name: "Sprint Coder", username: "example-sprints", bio: "Short, intense sessions between code reviews.", tone: "#55a7ff", seed: 41,
    languages: [{ name: "Python", percentage: 55 }, { name: "SQL", percentage: 30 }, { name: "YAML", percentage: 15 }],
    days: [burstsA, burstsB, burstsA, "missing", "missing", burstsB, burstsA, burstsB, burstsA, burstsB, "missing", "missing", burstsA, burstsB] },
] as const;

export const exampleDevelopers: ExampleDeveloper[] = plans.map((plan) => {
  const fingerprint = buildFingerprint(synthesizeFingerprintDays(FROM, plan.seed, plan.days), { from: FROM, to: TO });
  const summary = summarizeFingerprint(fingerprint);
  return {
    key: plan.key, name: plan.name, username: plan.username, bio: plan.bio, tone: plan.tone, languages: plan.languages, fingerprint,
    codingMs: summary.total,
    activeDates: fingerprint.ridges.filter((ridge) => (ridge.total ?? 0) > 0).length,
    peakHour: summary.busiestHour,
  };
});
