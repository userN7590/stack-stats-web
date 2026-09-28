import { HomeView, type HomeExample } from "@/components/home/home-view";
import { defaultBackgroundStyle, defaultDisplayFont } from "@/lib/appearance";
import { exampleProfile } from "@/lib/example-profile";
import { applyPublicProjection } from "@/lib/public-profile";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

const EXAMPLE_USERNAME = "fil";

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let profileUsername: string | null = null;

  if (userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error("Could not load the signed-in profile.");
    }

    profileUsername = profile?.username ?? null;
  }

  return (
    <HomeView
      viewer={{ signedIn: Boolean(userId), username: profileUsername }}
      example={await loadHomeExample(supabase)}
    />
  );
}

/**
 * The live example uses the same approved public projection as /u/fil. On any
 * failure the clearly labelled example persona is shown instead.
 */
async function loadHomeExample(supabase: Awaited<ReturnType<typeof createClient>>): Promise<HomeExample> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", EXAMPLE_USERNAME)
      .maybeSingle();
    if (error || !data) return { profile: exampleProfile, live: false };

    const { data: languages, error: languageError } = await supabase
      .from("profile_languages")
      .select("*")
      .eq("user_id", data.user_id)
      .order("percentage", { ascending: false });
    const baseProfile = {
      ...(data as Profile),
      display_font: data.display_font ?? defaultDisplayFont,
      background_style: data.background_style ?? defaultBackgroundStyle,
      languages: languageError ? [] : (languages as ProfileLanguage[] | null) ?? [],
    };
    return { profile: await applyPublicProjection(supabase, baseProfile, EXAMPLE_USERNAME), live: true };
  } catch {
    return { profile: exampleProfile, live: false };
  }
}
