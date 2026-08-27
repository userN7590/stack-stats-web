import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { AppearanceForm } from "@/components/dashboard/appearance-form";
import {
  ProfileForm,
  type ProfileFormSection,
} from "@/components/dashboard/profile-form";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileLanguage } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

type ProfileSection = ProfileFormSection | "appearance";

const profileSections: ProfileSection[] = [
  "identity",
  "links",
  "stats",
  "languages",
  "appearance",
];

const sectionContent: Record<
  ProfileSection,
  { eyebrow: string; title: string; description: string }
> = {
  identity: {
    eyebrow: "Edit identity",
    title: "How you appear.",
    description: "Update the public name, username, bio, and avatar on your profile.",
  },
  links: {
    eyebrow: "Edit links",
    title: "Your places on the web.",
    description: "Keep the destinations visitors use to find your work up to date.",
  },
  stats: {
    eyebrow: "Edit development totals",
    title: "The work in numbers.",
    description: "Update the aggregate coding totals you choose to report.",
  },
  languages: {
    eyebrow: "Edit languages",
    title: "Your language activity.",
    description: "Adjust the self-reported percentage breakdown shown publicly.",
  },
  appearance: {
    eyebrow: "Edit appearance",
    title: "Make it feel like yours.",
    description:
      "Choose a curated display font and a subtle background for your public profile.",
  },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const sectionParam = (await searchParams).section;
  const sectionValue = typeof sectionParam === "string" ? sectionParam : null;
  const section = profileSections.includes(sectionValue as ProfileSection)
    ? (sectionValue as ProfileSection)
    : null;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const [{ data: profile, error: profileError }, { data: languages, error: languageError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("profile_languages")
        .select("*")
        .eq("user_id", userId)
        .order("percentage", { ascending: false }),
    ]);

  if (profileError || languageError) {
    throw new Error(
      profileError?.message || languageError?.message || "Could not load your profile.",
    );
  }

  if (profile && !section) {
    redirect(`/u/${profile.username}`);
  }

  if (!profile && section !== null && section !== "identity") {
    redirect("/dashboard");
  }

  if (!profile && sectionParam !== undefined && !section) {
    redirect("/dashboard");
  }

  const email =
    typeof claimsData.claims.email === "string"
      ? claimsData.claims.email
      : "Signed-in account";
  const typedProfile = (profile as Profile | null) ?? null;
  const typedLanguages = (languages as ProfileLanguage[] | null) ?? [];
  const header = section
    ? sectionContent[section]
    : {
        eyebrow: "Account ready",
        title: "Build your public profile.",
        description:
          "Your account is ready. Start with the identity visitors will see, then add totals, links, and languages when you want to.",
      };

  return (
    <main className="min-h-screen bg-[#11110d] text-[#edeae0]">
      <nav className="border-b border-[#2b2a24] bg-[#11110d]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate font-mono text-[10px] text-[#77746b] md:inline">
              {email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <header className="mb-12 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#55a7ff]">
            {header.eyebrow}
          </p>
          <h1 className="mt-4 [font-family:Georgia,'Times_New_Roman',serif] text-4xl leading-tight text-[#edeae0] sm:text-5xl">
            {header.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#969287] sm:text-base">
            {header.description}
          </p>
        </header>

        {!typedProfile && !section ? (
          <section className="border-y border-[#2b2a24] py-9 sm:py-12">
            <div className="max-w-2xl border-l-2 border-[#55a7ff] pl-5 sm:pl-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
                First step
              </p>
              <h2 className="mt-3 [font-family:Georgia,'Times_New_Roman',serif] text-3xl text-[#edeae0]">
                Introduce yourself.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#aaa69a]">
                Choose a unique username and add the public identity details you
                want to share. You can manage links, totals, and languages after
                your profile is created.
              </p>
              <Link
                href="/dashboard?section=identity"
                className="group mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-[#55a7ff] px-5 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#11110d]"
              >
                Start your profile
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </section>
        ) : section === "appearance" && typedProfile ? (
          <AppearanceForm profile={typedProfile} />
        ) : section ? (
          <ProfileForm
            initialProfile={typedProfile}
            initialLanguages={typedLanguages}
            section={section as ProfileFormSection}
          />
        ) : null}
      </div>
    </main>
  );
}
