import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileView } from "@/components/profile/profile-view";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileLanguage } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;

  return {
    title: `@${username}`,
    description: `View @${username}'s public developer profile on Stack Stats.`,
  };
}

export default async function PublicProfilePage({
  params,
}: PageProps<"/u/[username]">) {
  const { username } = await params;
  const normalizedUsername = username.toLowerCase();
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    notFound();
  }

  const { data: languages, error: languageError } = await supabase
    .from("profile_languages")
    .select("*")
    .eq("user_id", profile.user_id)
    .order("percentage", { ascending: false });

  if (languageError) {
    throw new Error(languageError.message);
  }

  return (
    <ProfileView
      profile={{
        ...(profile as Profile),
        languages: (languages as ProfileLanguage[] | null) ?? [],
      }}
    />
  );
}
