"use client";
import { useState } from "react";
import { metricRegistry, publicMetricIds, type PublicMetricId } from "@/lib/metric-registry";

type Preferences = { publishProfile: boolean; publishLanguages: boolean; publicationVersion?: number; metricIds?: PublicMetricId[]; publishSchedule?: boolean };
export function SyncPrivacyForm({ initial, availableMetricIds = [] }: { initial: Preferences; availableMetricIds?: PublicMetricId[] }) {
  const [value, setValue] = useState(initial);
  const [selecting, setSelecting] = useState(initial.publicationVersion === 2);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selections = value.metricIds ?? [];
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(selecting ? "/api/v2/sync/privacy" : "/api/v1/sync/privacy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selecting
        ? { schemaVersion: "2", publishProfile: value.publishProfile, metricIds: selections, publishSchedule: value.publishSchedule ?? false }
        : { publishProfile: value.publishProfile, publishLanguages: value.publishLanguages }), signal: AbortSignal.timeout(15_000) });
      if (response.ok) {
        if (selecting) setValue({ ...value, publicationVersion: 2 });
        setMessage("Publication preferences saved. Reload your profile to use the updated published data.");
      } else setMessage("Preferences were not saved. Please sign in again or retry.");
    } catch { setMessage("Network unavailable. Preferences were not saved."); }
    finally { setBusy(false); }
  }
  return <div id="publication" className="space-y-6 text-sm leading-7">
    <p>Private uploads and public publication are separate choices. Nothing is published by default. Choosing profile sections never changes these permissions.</p>
    <fieldset disabled={busy} className="space-y-6">
      <legend className="sr-only">Publication preferences</legend>
      <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-2 size-5" checked={value.publishProfile} onChange={event => setValue({ ...value, publishProfile: event.target.checked })} /><span>{selecting ? "Publish my selected synced metrics." : "Use available synced totals on my public profile: coding time, line changes, edits, file-days, and project count. Saved manual values remain intact."}</span></label>
      {!selecting ? <>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-2 size-5" checked={value.publishLanguages} onChange={event => setValue({ ...value, publishLanguages: event.target.checked })} /><span>Also publish the synced language breakdown.</span></label>
        <button type="button" className="min-h-11 border border-[#444239] px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]" onClick={() => { setSelecting(true); setValue({ ...value, metricIds: [], publishSchedule: false }); }}>Choose individual metrics</button>
      </> : <>
        {value.publicationVersion !== 2 && <p className="border-l border-[#55a7ff] pl-4 text-[#c8c4b9]">Saving switches from legacy totals to only the metrics you select below. Your profile may show “Not published” for other stats. This cannot be switched back to broad legacy publication; you can always change selections or turn publication off.</p>}
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-2 size-5" checked={value.publishSchedule ?? false} onChange={event => setValue({ ...value, publishSchedule: event.target.checked, metricIds: event.target.checked ? selections : selections.filter(id => metricRegistry[id].publication !== "schedule-consent") })} /><span>Allow publication of activity dates and UTC hour patterns. These can reveal my work schedule. I still choose each schedule metric below.</span></label>
        <div className="divide-y divide-[#2b2a24]">{publicMetricIds.map(id => {
          const definition = metricRegistry[id];
          const selected = selections.includes(id);
          const available = availableMetricIds.includes(id);
          const permission = definition.publication !== "schedule-consent" || value.publishSchedule;
          return <label key={id} className="flex min-h-11 items-start gap-3 py-4"><input type="checkbox" className="mt-1.5 size-5 shrink-0" checked={selected} disabled={!selected && (!available || !permission)} onChange={event => setValue({ ...value, metricIds: event.target.checked ? [...selections, id] : selections.filter(metric => metric !== id) })} /><span><span className="block text-[#edeae0]">{definition.label}</span><span className="block text-xs leading-5 text-[#aaa69a]">{definition.description}</span>{!available && <span className="block text-xs text-[#aaa69a]">Unavailable in the last 30 days{definition.requiresWireVersion === "2" ? "; requires richer synced observations" : ""}. {selected ? "Selection retained; you may remove it." : ""}</span>}{!permission && <span className="block text-xs text-[#aaa69a]">Additional schedule permission required.</span>}</span></label>;
        })}</div>
        <p>Selected metrics: {selections.map(id => metricRegistry[id].label).join(", ") || "None"}.</p>
        {value.publicationVersion !== 2 && <button type="button" className="min-h-11 underline" onClick={() => { setSelecting(false); setValue(initial); }}>Keep legacy publication</button>}
      </>}
      <p className="text-[#aaa69a]">Project aliases remain private. Uploaded observations may be partial; independent editor installations can overlap. Activity dates and hour patterns are public only with the additional permission and corresponding metric selected.</p>
      <p className="text-[#aaa69a]">Turning off publication restores your existing public manual statistics and languages. It does not delete uploads or revoke editor authorization.</p>
      <button disabled={busy} type="button" className="min-h-11 rounded-[3px] bg-[#55a7ff] px-5 py-3 font-semibold text-[#11110d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:opacity-50" onClick={save}>{busy ? "Saving…" : "Save publication preferences"}</button>
    </fieldset>
    {message && <p role="status">{message}</p>}
  </div>;
}
