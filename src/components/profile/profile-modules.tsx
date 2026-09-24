import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { LanguageDonutChart } from "@/components/profile/language-donut-chart";
import { formatDate, formatNumber, getHostname } from "@/lib/format";
import { moduleDefinitions, type ModuleType, type ProfileLayout, type ProfileModule } from "@/lib/profile-layout";
import { getProfileMetrics } from "@/lib/profile-metrics";
import type { PublicProfile } from "@/lib/types";

type ModuleProps = { profile: PublicProfile; module: ProfileModule };

export function hasModuleContent(type: ModuleType, profile: PublicProfile) {
  if (type === "links") return Boolean(profile.github_url || profile.website_url);
  if (type === "languages") return profile.languages.length > 0;
  return true;
}

// New presentations plug in here; data adapters remain outside the renderers.
const renderers: Record<ModuleType, (props: ModuleProps) => ReactNode> = {
  stats: HeadlineStats,
  code_changes: CodeChanges,
  languages: Languages,
  links: Links,
};

export function ProfileModuleContent(props: ModuleProps) {
  const Renderer = renderers[props.module.type];
  return <Renderer {...props} />;
}

export function ProfileModules({ profile, layout, isOwner = false }: {
  profile: PublicProfile;
  layout: ProfileLayout;
  isOwner?: boolean;
}) {
  const visibleModules = layout.modules.filter((module) => module.visible && (
    hasModuleContent(module.type, profile) || (isOwner && module.type === "languages")
  ));

  if (visibleModules.length === 0) {
    return <p className="py-10 text-sm text-[#969287]">No profile sections are available to display yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {visibleModules.map((module) => (
        <section
          key={module.type}
          data-profile-section={module.type}
          aria-label={moduleDefinitions[module.type].label}
          className={`min-w-0 border-b border-[#2b2a24] py-8 sm:py-10 ${module.size === "full" ? "sm:col-span-2" : ""}`}
        >
          <ProfileModuleContent profile={profile} module={module} />
        </section>
      ))}
    </div>
  );
}

function SectionTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div>
      {eyebrow && <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#969287]">{eyebrow}</p>}
      <h2 className="mt-2 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">{children}</h2>
    </div>
  );
}

function HeadlineStats({ profile, module }: ModuleProps) {
  if (module.type !== "stats") return null;
  const metrics = getProfileMetrics(profile);
  const synced = profile.stats_source === "synced";
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle eyebrow={synced ? "Automatically tracked by Stack Stats" : "Self-reported aggregate data"}>
          Development totals
        </SectionTitle>
        <p className="font-mono text-[11px] text-[#858177]">
          {synced ? "Synced" : "Updated"} {formatDate(profile.updated_at)}
        </p>
      </div>
      <div className={`mt-7 grid border-l border-t border-[#2b2a24] ${module.stats.length === 1 ? "grid-cols-1" : module.stats.length === 2 || module.stats.length === 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {module.stats.map((id) => (
          <article key={id} data-profile-stat={id} className="min-w-0 border-b border-r border-[#2b2a24] px-4 py-5 sm:px-5 sm:py-6">
            <p className="truncate font-mono text-xl tracking-[-0.035em] text-[#edeae0] sm:text-2xl">{metrics[id].value}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#969287]">{metrics[id].label}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function CodeChanges({ profile }: ModuleProps) {
  const total = profile.lines_added + profile.lines_removed;
  return (
    <>
      <SectionTitle eyebrow="Added / removed">Code changes</SectionTitle>
      {total > 0 ? (
        <>
          <div className="mt-6 flex h-2 w-full overflow-hidden bg-[#24231e]" role="img" aria-label={`${formatNumber(profile.lines_added)} lines added and ${formatNumber(profile.lines_removed)} lines removed`}>
            <span className="h-full bg-[#65c58f]" style={{ width: `${profile.lines_added / total * 100}%` }} />
            <span className="h-full flex-1 bg-[#d8aa54]" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-[#969287]">
            <span><span className="mr-2 inline-block size-2 bg-[#65c58f]" />{formatNumber(profile.lines_added)} added</span>
            <span><span className="mr-2 inline-block size-2 bg-[#d8aa54]" />{formatNumber(profile.lines_removed)} removed</span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[#969287]">
          {profile.stats_source === "synced" ? "No added or removed lines in the synced activity." : "No added or removed line totals have been reported."}
        </p>
      )}
    </>
  );
}

function Languages({ profile, module }: ModuleProps) {
  const synced = profile.stats_source === "synced";
  return (
    <>
      <SectionTitle eyebrow="Current distribution">Language activity</SectionTitle>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#969287]">
        {synced ? "Automatically tracked by Stack Stats. Percentages reflect this developer’s synced activity." : "A self-reported percentage breakdown of this developer’s aggregate activity."}
      </p>
      <div className="mt-7">
        {profile.languages.length > 0 ? (
          <LanguageDonutChart languages={profile.languages} compact={module.size === "half"} />
        ) : (
          <p className="border border-dashed border-[#34332c] px-6 py-8 text-sm text-[#969287]">
            {synced ? "No language activity is published." : "No language activity has been added yet."}
          </p>
        )}
      </div>
    </>
  );
}

function Links({ profile }: ModuleProps) {
  const linkClass = "inline-flex min-w-0 items-center gap-1.5 text-[#c8c4b9] underline decoration-[#444239] underline-offset-4 transition hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]";
  return (
    <>
      <SectionTitle>Links</SectionTitle>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 font-mono text-xs">
        {profile.github_url && <a href={profile.github_url} target="_blank" rel="noreferrer" className={linkClass}>GitHub <ExternalLink className="size-3 shrink-0" /></a>}
        {profile.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer" className={linkClass}><span className="truncate">{getHostname(profile.website_url)}</span><ExternalLink className="size-3 shrink-0" /></a>}
        {!hasModuleContent("links", profile) && <p className="text-sm text-[#969287]">Add links in profile details. This section stays hidden from visitors until then.</p>}
      </div>
    </>
  );
}
