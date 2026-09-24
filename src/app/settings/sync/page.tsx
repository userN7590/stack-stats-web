import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SyncPrivacyForm } from "@/components/dashboard/sync-privacy";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sync privacy", robots: { index: false, follow: false } };
export default async function SyncPrivacyPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=/settings/sync");
  const [privacy, summary] = await Promise.all([supabase.rpc("sync_get_privacy"), supabase.rpc("sync_private_summary", { p_period: "30" })]);
  if (privacy.error || summary.error) throw new Error("Sync preferences are unavailable. Retry shortly.");
  return <AuthShell eyebrow="Account privacy" title="Your synced statistics" description="Stack Stats tracks locally by default. Connecting an account enables optional profile synchronization." alternateHref="/dashboard" alternateLabel="Your profile">
    <p className="mb-6 text-sm">Last 30 days (UTC end date): {Math.floor((summary.data?.activeMs ?? 0) / 60_000).toLocaleString()} coding minutes · {(summary.data?.activeDays ?? 0).toLocaleString()} active days · {(summary.data?.sessionDays ?? 0).toLocaleString()} session-days.</p>
    <SyncPrivacyForm initial={privacy.data} />
    <Link className="mt-6 block text-sm underline" href="/extension/connect">Manage editor connections</Link>
  </AuthShell>;
}
