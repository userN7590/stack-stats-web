"use client";

import { useState } from "react";

type LinkRequest = { challenge: string; state: string; redirectUri: string; scope?: "stats:write" };
export function ExtensionConsent({ request, username, cancelUrl }: { request: LinkRequest; username: string; cancelUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [callback, setCallback] = useState<string>();
  async function approve() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/extension/authorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("approval_failed");
      const data = await response.json();
      setCallback(data.callbackUrl);
      setMessage("Approved. Open VS Code to finish connecting. This link expires in 90 seconds.");
      window.location.assign(data.callbackUrl);
    } catch { setMessage("Could not approve this connection. Check your connection and sign-in, then try again from VS Code."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5 text-sm leading-7">
    <p>{request.scope ? "Enable private summary uploads" : "Connect VS Code"} as <strong>@{username}</strong>?</p>
    <p>Stack Stats tracks locally by default. Connecting an account enables optional profile synchronization.</p>
    {request.scope ? <p className="text-[#969287]">Approve stats:write: upload daily coding time, edits, line changes, file and session counts, language totals, and opaque project totals. Initial history is limited to the last 90 local calendar days; enabled installations continue uploading subsequent activity. No source, file names, prompts, raw events, or project names are uploaded. Uploads are private. Publishing totals and languages requires a separate choice in Sync Privacy.</p> : <p className="text-[#969287]">This connection shares only your account identity. It does not authorize coding history uploads.</p>}
    <p className="text-[#969287]">Only approve if you just requested this connection or Profile Sync in your editor.</p>
    <button className="rounded bg-[#55a7ff] px-5 py-3 font-semibold text-[#11110d] disabled:opacity-50" disabled={busy || Boolean(callback)} onClick={approve}>{busy ? "Connecting…" : request.scope ? "Approve private summary uploads" : "Connect VS Code"}</button>
    <a className="ml-5 underline" href={cancelUrl}>Cancel</a>
    {message && <p role="status">{message}</p>}
    {callback && <a className="block text-[#55a7ff] underline" href={callback}>Return to VS Code</a>}
  </div>;
}

export function RevokeExtensionConnections() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function revoke() {
    if (!window.confirm("Disconnect all Stack Stats editors? Your account and coding history will remain.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/extension/revoke-all", { method: "POST", signal: AbortSignal.timeout(15_000) });
      setMessage(response.ok ? "All editor connections revoked." : "Could not revoke connections. Please try again.");
    } catch { setMessage("Network unavailable. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4 text-sm leading-7">
    <p>Disconnect your editors without deleting your account, public profile, or local coding history.</p>
    <button className="rounded border border-[#555149] px-5 py-3 disabled:opacity-50" disabled={busy} onClick={revoke}>{busy ? "Disconnecting…" : "Disconnect all editors"}</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
