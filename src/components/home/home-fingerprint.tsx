"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ActivityFingerprint } from "@/components/fingerprint/activity-fingerprint";
import { formatUtcHour, representativeFingerprint, summarizeFingerprint, type FingerprintModel } from "@/lib/activity-fingerprint";
import { formatDurationMs } from "@/lib/format";
import { loadOwnerFingerprint, type OwnerFingerprintResult } from "@/lib/owner-fingerprint";

type OwnerState = { status: "idle" | "loading" } | OwnerFingerprintResult;

const messages: Record<Exclude<OwnerState["status"], "idle" | "loading" | "ready">, string> = {
  empty: "No hourly activity in your last 30 days yet. UTC hourly upload is optional and off by default in the editor extension.",
  "signed-out": "Your session has ended. Log in again to use your own activity.",
  "not-permitted": "Your account has not approved richer private aggregates, so there is no hourly data to show.",
  unavailable: "Your activity could not be loaded right now.",
};

/** Headline statistics derived from exactly the model being displayed. */
export function activityStats(model: FingerprintModel) {
  const summary = summarizeFingerprint(model);
  const activeDates = model.ridges.filter((ridge) => ridge.status === "observed" && ridge.total! > 0).length;
  return [
    { value: formatDurationMs(summary.total), label: "Coding time" },
    { value: `${activeDates}/${model.ridges.length}`, label: "Active dates" },
    { value: summary.busiestHour === null ? "—" : formatUtcHour(summary.busiestHour), label: "Busiest hour, UTC" },
    { value: summary.busiestDay ? formatDurationMs(summary.busiestDay.total!) : "—", label: "Longest day" },
  ];
}

/**
 * Homepage activity: statistics and the fingerprint, always from the same
 * model. Everyone sees the example first. A signed-in owner may explicitly
 * load their own private hourly rows; they stay in this page's memory and are
 * never rendered on the server, stored or published.
 */
export function HomeFingerprint({ signedIn, intro }: { signedIn: boolean; intro: ReactNode }) {
  const example = useMemo(() => representativeFingerprint(), []);
  const [owner, setOwner] = useState<OwnerState>({ status: "idle" });
  const ownerModel: FingerprintModel | null = owner.status === "ready" ? owner.model : null;
  const model = ownerModel ?? example;
  const stats = useMemo(() => activityStats(model), [model]);

  async function loadMine() {
    setOwner({ status: "loading" });
    setOwner(await loadOwnerFingerprint());
  }

  const controls = signedIn ? (
    <div className="fp-owner">
      {ownerModel ? (
        <button type="button" className="fp-owner-toggle" onClick={() => setOwner({ status: "idle" })}>Show example</button>
      ) : (
        <button type="button" className="fp-owner-toggle" onClick={loadMine} disabled={owner.status === "loading"} title="Loads your private hourly activity into this page only">
          {owner.status === "loading" ? "Loading…" : "Use my activity"}
        </button>
      )}
      {owner.status !== "idle" && owner.status !== "loading" && owner.status !== "ready" && (
        <p role="status" className="fp-owner-status">
          {messages[owner.status]} <Link href="/settings/sync">Sync settings</Link>
        </p>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="site-grid site-inset pt-16 md:pt-20">
        {intro}
        <dl className="activity-stats md:col-span-4" aria-label={ownerModel ? "Your last 30 days" : "Example: 30 days"}>
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="activity-figure site-inset pb-12 pt-6 md:pb-16">
        <ActivityFingerprint
          key={ownerModel ? "owner" : "example"}
          model={model}
          title={ownerModel ? "Your activity fingerprint, last 30 UTC dates" : "Activity fingerprint, example data"}
          label={ownerModel ? "Your last 30 days · visible only to you" : "30 days of coding · example data"}
          dateStyle={ownerModel ? "calendar" : "relative"}
          controls={controls}
        />
      </div>
    </>
  );
}
