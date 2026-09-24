import { ArrowLeft, ExternalLink, Pencil, UserPlus } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Avatar } from "@/components/profile/avatar";
import { LanguageDonutChart } from "@/components/profile/language-donut-chart";
import { ProfileBackground } from "@/components/profile/profile-background";
import { AppNavbar } from "@/components/ui/app-navbar";
import { Logo } from "@/components/ui/logo";
import {
  getDisplayFontClass,
  normalizeBackgroundStyle,
} from "@/lib/appearance";
import {
  formatCodingTime,
  formatDate,
  formatNumber,
  getHostname,
} from "@/lib/format";
import type { PublicProfile } from "@/lib/types";

type ProfileViewProps = {
  profile: PublicProfile;
  isExample?: boolean;
  isOwner?: boolean;
};

export function ProfileView({
  profile,
  isExample = false,
  isOwner = false,
}: ProfileViewProps) {
  const name = profile.display_name || profile.username;
  const displayFontClass = getDisplayFontClass(profile.display_font);
  const backgroundStyle = normalizeBackgroundStyle(profile.background_style);
  const hasStatistics = [
    profile.lines_added,
    profile.lines_removed,
    profile.files_changed,
    profile.edit_events,
    profile.projects_count,
    profile.coding_minutes,
  ].some((value) => value > 0);
  const totalLineChanges = profile.lines_added + profile.lines_removed;
  const addedShare =
    totalLineChanges > 0 ? (profile.lines_added / totalLineChanges) * 100 : 0;
  const stats = [
    ["Lines added", formatNumber(profile.lines_added)],
    ["Lines removed", formatNumber(profile.lines_removed)],
    [profile.stats_source === "synced" ? "File-days" : "Files changed", formatNumber(profile.files_changed)],
    ["Edit events", formatNumber(profile.edit_events)],
    [profile.stats_source === "synced" ? "Project identities" : "Projects", formatNumber(profile.projects_count)],
    ["Coding time", formatCodingTime(profile.coding_minutes)],
  ];

  return (
    <main className="relative isolate min-h-screen overflow-x-hidden bg-[#11110d] text-[#edeae0]">
      <ProfileBackground style={backgroundStyle} />

      <AppNavbar>
        {isOwner && !isExample ? (
          <>
            <Link
              href="/"
              className="font-mono text-xs text-[#aaa69a] underline decoration-[#444239] underline-offset-4 transition hover:text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
            >
              Home
            </Link>
            <LogoutButton />
          </>
        ) : (
          <Link
            href={isExample ? "/" : "/signup"}
            aria-label={isExample ? "Back home" : "Create your profile"}
            className="inline-flex size-10 items-center justify-center gap-2 font-mono text-xs text-[#aaa69a] underline decoration-[#444239] underline-offset-4 transition hover:text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] sm:size-auto"
          >
            {isExample ? (
              <ArrowLeft className="size-3.5" />
            ) : (
              <UserPlus className="size-4 sm:hidden" />
            )}
            <span className={isExample ? "" : "sr-only sm:not-sr-only"}>
              {isExample ? "Back home" : "Create your profile"}
            </span>
          </Link>
        )}
      </AppNavbar>

      <div className="relative z-10 mx-auto max-w-[840px] px-5 py-10 sm:px-8 sm:py-16">
        {isExample && (
          <p className="mb-8 border-l-2 border-[#55a7ff] pl-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#aaa69a]">
            Example profile
          </p>
        )}

        <header className="border-b border-[#2b2a24] pb-10 sm:pb-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <Avatar name={name} src={profile.avatar_url} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h1
                  className={`${displayFontClass} min-w-0 text-4xl leading-[1.05] tracking-[-0.035em] text-[#edeae0] sm:text-5xl`}
                >
                  {name}
                </h1>
                {isOwner && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <OwnerEditLink
                      href="/dashboard?section=identity"
                      label="Edit profile"
                    />
                    <OwnerEditLink
                      href="/dashboard?section=appearance"
                      label="Edit appearance"
                    />
                  </div>
                )}
              </div>
              <p className="mt-2 font-mono text-sm text-[#55a7ff]">
                @{profile.username}
              </p>

              {profile.bio && (
                <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#b8b4a9] sm:text-base">
                  {profile.bio}
                </p>
              )}

              {(profile.github_url || profile.website_url || isOwner) && (
                <div className="mt-6 border-t border-[#2b2a24] pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#858177]">
                      Links
                    </p>
                    {isOwner && (
                      <OwnerEditLink
                        href="/dashboard?section=links"
                        label="Edit links"
                      />
                    )}
                  </div>
                  {profile.github_url || profile.website_url ? (
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs">
                      {profile.github_url && (
                        <a
                          href={profile.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#c8c4b9] underline decoration-[#444239] underline-offset-4 transition hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
                        >
                          GitHub <ExternalLink className="size-3" />
                        </a>
                      )}
                      {profile.website_url && (
                        <a
                          href={profile.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-0 items-center gap-1.5 text-[#c8c4b9] underline decoration-[#444239] underline-offset-4 transition hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
                        >
                          <span className="max-w-56 truncate">
                            {getHostname(profile.website_url)}
                          </span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#858177]">
                      No links added yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="py-10 sm:py-12" aria-labelledby="coding-stats-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#969287]">
                Self-reported aggregate data
              </p>
              <h2
                id="coding-stats-heading"
                className="mt-2 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]"
              >
                Development totals
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-mono text-[11px] text-[#858177]">
                {profile.stats_source === "synced" ? "Synced" : "Updated"} {formatDate(profile.updated_at)}
              </p>
              {isOwner && (
                <OwnerEditLink
                  href={profile.stats_source === "synced" ? "/settings/sync" : "/dashboard?section=stats"}
                  label="Edit totals"
                />
              )}
            </div>
          </div>

          {hasStatistics ? (
            <>
              <div className="mt-7 grid grid-cols-2 border-l border-t border-[#2b2a24] sm:grid-cols-3">
                {stats.map(([label, value]) => (
                  <article
                    key={label}
                    className="min-w-0 border-b border-r border-[#2b2a24] px-4 py-5 sm:px-5 sm:py-6"
                  >
                    <p className="truncate font-mono text-xl tracking-[-0.035em] text-[#edeae0] sm:text-2xl">
                      {value}
                    </p>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#969287]">
                      {label}
                    </p>
                  </article>
                ))}
              </div>

              <div className="mt-9 border-y border-[#2b2a24] py-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-mono text-xs text-[#c8c4b9]">Code changes</h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#858177]">
                    Added / removed
                  </span>
                </div>
                {totalLineChanges > 0 ? (
                  <>
                    <div
                      className="mt-4 flex h-2 w-full overflow-hidden bg-[#24231e]"
                      aria-label={`${formatNumber(profile.lines_added)} lines added and ${formatNumber(profile.lines_removed)} lines removed`}
                    >
                      <span
                        className="h-full bg-[#65c58f]"
                        style={{ width: `${addedShare}%` }}
                      />
                      <span className="h-full flex-1 bg-[#d8aa54]" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-[#969287]">
                      <span>
                        <span className="mr-2 inline-block size-2 bg-[#65c58f]" />
                        {formatNumber(profile.lines_added)} added
                      </span>
                      <span>
                        <span className="mr-2 inline-block size-2 bg-[#d8aa54]" />
                        {formatNumber(profile.lines_removed)} removed
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-[#969287]">
                    No added or removed line totals have been reported.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="mt-7 border border-dashed border-[#34332c] px-6 py-10">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#969287]">
                No coding totals yet
              </p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#aaa69a]">
                This developer has established their identity here and can add
                aggregate coding statistics whenever they are ready.
              </p>
            </div>
          )}
        </section>

        {(profile.languages.length > 0 || isOwner) && (
          <section
            className="border-t border-[#2b2a24] py-10 sm:py-12"
            aria-labelledby="languages-heading"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#969287]">
                  Current distribution
                </p>
                <h2
                  id="languages-heading"
                  className="mt-2 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]"
                >
                  Language activity
                </h2>
              </div>
              {isOwner && (
                <OwnerEditLink
                  href={profile.stats_source === "synced" ? "/settings/sync" : "/dashboard?section=languages"}
                  label="Edit languages"
                />
              )}
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#969287]">
              A self-reported percentage breakdown of this developer’s aggregate
              activity.
            </p>

            {profile.languages.length > 0 ? (
              <div className="mt-7">
                <LanguageDonutChart
                  languages={profile.languages.map((language) => ({
                    name: language.name,
                    percentage: language.percentage,
                  }))}
                />
              </div>
            ) : (
              <div className="mt-7 border border-dashed border-[#34332c] px-6 py-8">
                <p className="text-sm text-[#969287]">
                  No language activity has been added yet.
                </p>
              </div>
            )}
          </section>
        )}

        <footer className="flex flex-col gap-4 border-t border-[#2b2a24] py-7 text-[11px] text-[#858177] sm:flex-row sm:items-center sm:justify-between">
          <p>Statistics are entered and maintained by the profile owner.</p>
          <div className="flex items-center gap-3">
            <span>Made with Stack Stats</span>
            <Logo compact />
          </div>
        </footer>
      </div>
    </main>
  );
}

function OwnerEditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[3px] border border-[#3b3931] px-2.5 font-mono text-[10px] text-[#aaa69a] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
    >
      <Pencil className="size-3" />
      {label}
    </Link>
  );
}
