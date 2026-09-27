import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SyncPrivacyForm } from "@/components/dashboard/sync-privacy";
import { createClient } from "@/lib/supabase/server";
import { privateMetrics } from "@/lib/sync-datasets";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sync privacy", robots: { index: false, follow: false } };
export default async function SyncPrivacyPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=/settings/sync");
  const [privacy, summary] = await Promise.all([supabase.rpc("sync_get_privacy_v2"), supabase.rpc("sync_private_summary_v2", { p_period: "30" })]);
  if (privacy.error || summary.error) throw new Error("Sync preferences are unavailable. Retry shortly.");
  const available = privateMetrics(summary.data);
  const metric = (id: string) => available.metrics.find(item => item.id === id)?.value ?? 0;
  return <AuthShell eyebrow="Account privacy" title="Your synced statistics" description="Stack Stats tracks locally by default. Connecting an account enables optional profile synchronization." alternateHref="/dashboard" alternateLabel="Your profile">
    <p className="mb-6 text-sm">{available.coverage.recordCount === 0 ? "No synced observations are available for the last 30 dates." : <>Last 30 recorded-local dates (UTC end date): {Math.floor(metric("activity.active_ms") / 60_000).toLocaleString()} coding minutes · {metric("activity.active_days").toLocaleString()} active days · {metric("sessions.days").toLocaleString()} session-days. Uploaded observations may be partial.</>}</p>
    <SyncPrivacyForm initial={privacy.data} />
    <Link className="mt-6 block text-sm underline" href="/extension/connect">Manage editor connections</Link>
  </AuthShell>;
}
