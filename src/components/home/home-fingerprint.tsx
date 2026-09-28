"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ActivityFingerprint } from "@/components/fingerprint/activity-fingerprint";
import { representativeFingerprint, type FingerprintModel } from "@/lib/activity-fingerprint";
import { loadOwnerFingerprint, type OwnerFingerprintResult } from "@/lib/owner-fingerprint";

type OwnerState = { status: "idle" | "loading" } | OwnerFingerprintResult;

const messages: Record<Exclude<OwnerState["status"], "idle" | "loading" | "ready">, string> = {
  empty: "No hourly observations in your last 30 days. UTC hourly upload is optional and off by default in the editor extension.",
  "signed-out": "Your session has ended. Log in again to load your own activity.",
  "not-permitted": "Your account has not approved richer private aggregates, so there is no hourly data to show.",
  unavailable: "Your hourly activity could not be loaded right now.",
};

/**
 * Hero fingerprint. Everyone sees the representative example first; a
 * signed-in owner may explicitly load their own private hourly rows, which
 * stay in this page's memory and are never rendered server-side or published.
 */
export function HomeFingerprint({ signedIn }: { signedIn: boolean }) {
  const example = useMemo(() => representativeFingerprint(), []);
  const [owner, setOwner] = useState<OwnerState>({ status: "idle" });
  const ownerModel: FingerprintModel | null = owner.status === "ready" ? owner.model : null;
  const model = ownerModel ?? example;

  async function showOwner() {
    setOwner({ status: "loading" });
    setOwner(await loadOwnerFingerprint());
  }

  const controls = signedIn ? (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {ownerModel ? (
        <button type="button" onClick={() => setOwner({ status: "idle" })} className="fp-control">Show example data</button>
      ) : (
        <button type="button" onClick={showOwner} disabled={owner.status === "loading"} className="fp-control" aria-describedby="owner-fingerprint-note">
          {owner.status === "loading" ? "Loading your activity…" : "Show my last 30 days"}
        </button>
      )}
      <span id="owner-fingerprint-note" className="text-[11px] text-[#858177]">
        {ownerModel ? "Private: loaded for you only, never published." : "Loads your private hourly activity into this page only."}
      </span>
      {owner.status !== "idle" && owner.status !== "loading" && owner.status !== "ready" && (
        <p role="status" className="basis-full text-[12px] text-[#c8c4b9]">
          {messages[owner.status]}{" "}
          <Link href="/settings/sync" className="text-[#55a7ff] underline decoration-[#3f668a] underline-offset-4">Sync settings</Link>
        </p>
      )}
    </div>
  ) : null;

  return (
    <ActivityFingerprint
      key={ownerModel ? "owner" : "example"}
      model={model}
      title={ownerModel ? "Your activity fingerprint" : "Activity fingerprint, representative example"}
      dateStyle={ownerModel ? "calendar" : "relative"}
      sourceNote={ownerModel
        ? <>Your private hourly activity, last 30 UTC dates. <strong className="font-normal text-[#edeae0]">Only you can see this view.</strong></>
        : <>Representative example data: thirty days of a fictional developer, <strong className="font-normal text-[#edeae0]">not your activity</strong>.</>}
      controls={controls}
    />
  );
}
