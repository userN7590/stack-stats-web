"use client";
import { useState } from "react";
export function SyncPrivacyForm({ initial }: { initial: { publishProfile: boolean; publishLanguages: boolean } }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/sync/privacy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal: AbortSignal.timeout(15_000) });
      setMessage(response.ok ? "Publication preferences saved." : "Preferences were not saved. Please sign in again or retry.");
    } catch { setMessage("Network unavailable. Preferences were not saved."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 text-sm leading-7">
    <p>Private uploads and public publication are separate choices. Enable uploads in your editor. Nothing is published by default.</p>
    <label className="flex items-start gap-3"><input type="checkbox" className="mt-2" checked={value.publishProfile} onChange={event => setValue({ ...value, publishProfile: event.target.checked })} /><span>Use synced lifetime totals on my public profile: coding time, line changes, edits, file-days, and project count. This replaces displayed manual totals once an upload exists; saved manual values remain intact.</span></label>
    <label className="flex items-start gap-3"><input type="checkbox" className="mt-2" checked={value.publishLanguages} onChange={event => setValue({ ...value, publishLanguages: event.target.checked })} /><span>Also publish the synced language breakdown. Otherwise languages are hidden while synced totals are displayed.</span></label>
    <p className="text-[#969287]">Project aliases and individual activity dates stay private. File-days sum distinct files per installation per day, not unique lifetime files. Project identities are installation-specific. Overlapping editor activity can still overlap in totals.</p>
    <p className="text-[#969287]">Turning off publication restores your existing public manual statistics and languages. Disable Profile Sync in each editor to stop future uploads; disconnect or revoke editor connections to remove their authorization. These actions retain previously uploaded data.</p>
    <button disabled={busy} className="rounded bg-[#55a7ff] px-5 py-3 font-semibold text-[#11110d] disabled:opacity-50" onClick={save}>{busy ? "Saving…" : "Save publication preferences"}</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
