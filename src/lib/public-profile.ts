import type { createClient } from "@/lib/supabase/server";
import { withPublishedMetrics, withSyncedProfile } from "@/lib/synced-profile";
import type { PublicProfile } from "@/lib/types";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * The approved public projection for a profile: selected v2 publication first,
 * legacy publication only when there is no v2 projection. Fails closed to the
 * saved manual profile; never reads private sync rows.
 */
export async function applyPublicProjection(supabase: Client, baseProfile: PublicProfile, username: string): Promise<PublicProfile> {
  const rich = await supabase.rpc("sync_public_profile_v2", { p_username: username });
  const synced = !rich.error && rich.data !== null ? null : await supabase.rpc("sync_public_profile", { p_username: username });
  return synced ? withSyncedProfile(baseProfile, synced.error ? null : synced.data) : withPublishedMetrics(baseProfile, rich.data);
}
