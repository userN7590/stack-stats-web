import {
  ArrowLeft,
  Clock3,
  Code2,
  ExternalLink,
  FileCode2,
  FolderKanban,
  GitBranch,
  Minus,
  MousePointer2,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/profile/avatar";
import { Logo } from "@/components/ui/logo";
import { formatCodingTime, formatNumber, getHostname } from "@/lib/format";
import type { PublicProfile } from "@/lib/types";

type ProfileViewProps = {
  profile: PublicProfile;
  isExample?: boolean;
};

const barColors = [
  "bg-emerald-400",
  "bg-cyan-400",
  "bg-violet-400",
  "bg-amber-300",
  "bg-rose-400",
  "bg-sky-400",
];

export function ProfileView({ profile, isExample = false }: ProfileViewProps) {
  const name = profile.display_name || profile.username;
  const hasStatistics = [
    profile.lines_added,
    profile.lines_removed,
    profile.files_changed,
    profile.edit_events,
    profile.projects_count,
    profile.coding_minutes,
  ].some((value) => value > 0);

  const stats = [
    {
      label: "Lines added",
      value: formatNumber(profile.lines_added),
      icon: Plus,
      tone: "text-emerald-300",
    },
    {
      label: "Lines removed",
      value: formatNumber(profile.lines_removed),
      icon: Minus,
      tone: "text-rose-300",
    },
    {
      label: "Files changed",
      value: formatNumber(profile.files_changed),
      icon: FileCode2,
      tone: "text-cyan-300",
    },
    {
      label: "Edit events",
      value: formatNumber(profile.edit_events),
      icon: MousePointer2,
      tone: "text-violet-300",
    },
    {
      label: "Projects",
      value: formatNumber(profile.projects_count),
      icon: FolderKanban,
      tone: "text-amber-200",
    },
    {
      label: "Coding time",
      value: formatCodingTime(profile.coding_minutes),
      icon: Clock3,
      tone: "text-sky-300",
    },
  ];

  return (
    <main className="min-h-screen bg-[#070a09] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-22rem] size-[42rem] -translate-x-1/2 rounded-full bg-emerald-400/[0.08] blur-[120px]" />
        <div className="profile-grid absolute inset-0 opacity-30" />
      </div>

      <nav className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link
            href={isExample ? "/" : "/signup"}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {isExample ? <ArrowLeft className="size-4" /> : <Sparkles className="size-4" />}
            {isExample ? "Back home" : "Build yours"}
          </Link>
        </div>
      </nav>

      <div className="relative z-[1] mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        {isExample && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Example profile
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0f0d]/90 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
          <div className="flex flex-col gap-7 p-6 sm:flex-row sm:items-start sm:p-9 lg:p-11">
            <Avatar name={name} src={profile.avatar_url} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                    {name}
                  </h1>
                  <p className="mt-1.5 font-mono text-sm text-emerald-300/80">
                    @{profile.username}
                  </p>
                  {profile.bio && (
                    <p className="mt-4 max-w-2xl text-[15px] leading-7 text-zinc-400 sm:text-base">
                      {profile.bio}
                    </p>
                  )}
                </div>

                {(profile.github_url || profile.website_url) && (
                  <div className="flex flex-wrap gap-2.5">
                    {profile.github_url && (
                      <a
                        href={profile.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <GitBranch className="size-4" />
                        GitHub
                      </a>
                    )}
                    {profile.website_url && (
                      <a
                        href={profile.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-56 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <ExternalLink className="size-4 shrink-0" />
                        <span className="truncate">
                          {getHostname(profile.website_url)}
                        </span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6" aria-labelledby="coding-stats-heading">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                Manually reported
              </p>
              <h2
                id="coding-stats-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-zinc-100"
              >
                Coding totals
              </h2>
            </div>
          </div>

          {hasStatistics ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <article
                    key={stat.label}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5"
                  >
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Icon className={`size-4 ${stat.tone}`} />
                      {stat.label}
                    </div>
                    <p className="mt-3 truncate font-mono text-xl font-semibold tracking-[-0.04em] text-zinc-100 sm:text-2xl">
                      {stat.value}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
              <div className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-500">
                <Code2 className="size-5" />
              </div>
              <h3 className="mt-4 font-medium text-zinc-200">
                No coding totals yet
              </h3>
              <p className="mt-1.5 max-w-md text-sm leading-6 text-zinc-500">
                This developer has set up their profile and can add aggregate
                coding statistics whenever they are ready.
              </p>
            </div>
          )}
        </section>

        {profile.languages.length > 0 && (
          <section
            className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-7"
            aria-labelledby="languages-heading"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  Breakdown
                </p>
                <h2
                  id="languages-heading"
                  className="mt-1 text-xl font-semibold tracking-tight text-zinc-100"
                >
                  Languages
                </h2>
              </div>
              <span className="font-mono text-xs text-zinc-600">
                {profile.languages.length} listed
              </span>
            </div>

            <div className="mt-7 grid gap-x-10 gap-y-6 md:grid-cols-2">
              {profile.languages.map((language, index) => (
                <div key={language.id}>
                  <div className="mb-2.5 flex items-center justify-between gap-4">
                    <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-zinc-300">
                      <span
                        className={`size-2 shrink-0 rounded-full ${barColors[index % barColors.length]}`}
                      />
                      <span className="truncate">{language.name}</span>
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      {formatNumber(language.percentage)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${barColors[index % barColors.length]}`}
                      style={{
                        width: `${Math.max(0, Math.min(100, language.percentage))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-zinc-600 sm:flex-row">
          <p>Statistics are entered and maintained by the profile owner.</p>
          <Link href="/" className="transition hover:text-zinc-300">
            Made with Stack Stats
          </Link>
        </footer>
      </div>
    </main>
  );
}
