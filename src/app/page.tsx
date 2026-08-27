import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Avatar } from "@/components/profile/avatar";
import { AppNavbar } from "@/components/ui/app-navbar";
import { Logo } from "@/components/ui/logo";
import { formatCodingTime, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

const languageColors = ["#55a7ff", "#65c58f", "#a58bd4", "#d8aa54"];

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

  const { data: filData, error: filError } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", "fil")
    .maybeSingle();
  let filProfile: Profile | null = null;
  let filLanguages: ProfileLanguage[] = [];

  if (!filError && filData) {
    filProfile = filData as Profile;
    const { data: languages, error: languageError } = await supabase
      .from("profile_languages")
      .select("*")
      .eq("user_id", filData.user_id)
      .order("percentage", { ascending: false });

    if (!languageError) {
      filLanguages = (languages as ProfileLanguage[] | null) ?? [];
    }
  }

  const primaryHref = profileUsername
    ? `/u/${profileUsername}`
    : userId
      ? "/dashboard"
      : "/signup";
  const primaryLabel = profileUsername
    ? "View your profile"
    : userId
      ? "Set up your profile"
      : "Create your profile";
  const showFilAction = profileUsername !== "fil";

  return (
    <main className="overflow-x-hidden bg-[#11110d] text-[#edeae0]">
      <AppNavbar>
        <div className="flex items-center gap-3 font-mono text-xs sm:gap-4">
          {userId ? (
            <>
              <Link
                href={profileUsername ? `/u/${profileUsername}` : "/dashboard"}
                className="border border-[#3b3931] px-3 py-2 text-[#edeae0] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
              >
                {profileUsername ? "Your profile" : "Set up profile"}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[#aaa69a] transition hover:text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="border border-[#3b3931] px-3 py-2 text-[#edeae0] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
              >
                Create profile
              </Link>
            </>
          )}
        </div>
      </AppNavbar>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:pb-18">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="[font-family:Georgia,'Times_New_Roman',serif] text-[2.75rem] leading-[0.98] tracking-[-0.045em] text-[#edeae0] [text-wrap:balance] sm:text-[3.5rem] lg:text-[4rem]">
            Your development. One profile.
          </h1>
          <p className="mt-5 text-base leading-7 text-[#aaa69a] sm:text-lg">
            Create a public profile for the work behind your code.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={primaryHref}
              className="group inline-flex min-h-11 items-center justify-center gap-2 bg-[#55a7ff] px-5 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#11110d]"
            >
              {primaryLabel}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {showFilAction && (
              <Link
                href="/u/fil"
                className="inline-flex min-h-11 items-center justify-center border border-[#3b3931] px-5 font-mono text-xs text-[#c8c4b9] transition hover:border-[#666258] hover:text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
              >
                View @fil
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl sm:mt-12">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#edeae0]">
            Example profile
          </p>
          {filProfile ? (
            <FilProfilePreview
              profile={filProfile}
              languages={filLanguages}
            />
          ) : (
            <FilFallback />
          )}
        </div>
      </section>

      <footer className="border-t border-[#2b2a24]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 text-[11px] text-[#77746b] sm:px-8">
          <Logo compact />
          <p>Public developer profiles.</p>
        </div>
      </footer>
    </main>
  );
}

function FilProfilePreview({
  profile,
  languages,
}: {
  profile: Profile;
  languages: ProfileLanguage[];
}) {
  const name = profile.display_name || profile.username;
  const stats = [
    ["Lines added", formatNumber(profile.lines_added)],
    ["Files changed", formatNumber(profile.files_changed)],
    ["Projects", formatNumber(profile.projects_count)],
    ["Coding time", formatCodingTime(profile.coding_minutes)],
  ];
  const visibleLanguages = languages.slice(0, 4);

  return (
    <article className="min-w-0 border-y border-[#34332c] py-6 sm:py-7">
      <div className="flex items-start gap-5">
        <Avatar name={name} src={profile.avatar_url} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate [font-family:Georgia,'Times_New_Roman',serif] text-3xl text-[#edeae0]">
            {name}
          </h2>
          <p className="mt-1 font-mono text-xs text-[#55a7ff]">@fil</p>
          {profile.bio && (
            <p className="mt-3 text-sm leading-6 text-[#969287]">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 border-l border-t border-[#2b2a24] sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-r border-[#2b2a24] px-3 py-3.5">
            <p className="truncate font-mono text-base text-[#edeae0]">{value}</p>
            <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#858177]">
              {label}
            </p>
          </div>
        ))}
      </div>

      {visibleLanguages.length > 0 && (
        <div className="mt-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#969287]">
            Language activity
          </p>
          <div className="mt-2.5 flex h-1.5 overflow-hidden bg-[#24231e]">
            {visibleLanguages.map((language, index) => (
              <span
                key={language.id}
                className="h-full"
                style={{
                  width: `${language.percentage}%`,
                  backgroundColor: languageColors[index],
                }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[9px] text-[#858177]">
            {visibleLanguages.map((language) => (
              <span key={language.id}>
                {language.name} {formatNumber(language.percentage)}%
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/u/fil"
        className="mt-5 inline-flex min-h-10 items-center gap-2 font-mono text-xs text-[#55a7ff] underline decoration-[#3f668a] underline-offset-4 transition hover:text-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
      >
        View example profile
        <ExternalLink className="size-3.5" />
      </Link>
    </article>
  );
}

function FilFallback() {
  return (
    <article className="border-y border-[#34332c] py-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#55a7ff]">
        Public profile
      </p>
      <h2 className="mt-3 [font-family:Georgia,'Times_New_Roman',serif] text-3xl text-[#edeae0]">
        @fil
      </h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#969287]">
        This profile preview is temporarily unavailable.
      </p>
      <Link
        href="/u/fil"
        className="mt-6 inline-flex min-h-10 items-center gap-2 font-mono text-xs text-[#55a7ff] underline decoration-[#3f668a] underline-offset-4 transition hover:text-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
      >
        View example profile
        <ArrowRight className="size-3.5" />
      </Link>
    </article>
  );
}
