import Link from "next/link";

import { Avatar } from "@/components/profile/avatar";
import { Crosshair } from "@/components/annotations/sketch";
import { formatPercentage } from "@/lib/format";
import { getLanguageDisplayName } from "@/lib/language-display";
import { getProfileMetrics } from "@/lib/profile-metrics";
import type { StatId } from "@/lib/profile-layout";
import type { PublicProfile } from "@/lib/types";

const languageColors = ["#55a7ff", "#65c58f", "#d8aa54", "#a58bd4", "#77746b"];
const statOrder: StatId[] = ["coding_minutes", "lines_added", "files_changed", "edit_events", "lines_removed", "projects_count"];
const withheld = new Set(["Not published", "Unavailable"]);

/**
 * A compact rendering of an actual public profile (the same approved
 * projection /u/[username] uses) or the labelled example persona. It never
 * reads private sync data and never fills unpublished slots.
 */
export function ExampleProfile({ profile, live }: { profile: PublicProfile; live: boolean }) {
  const name = profile.display_name || profile.username;
  const metrics = getProfileMetrics(profile);
  const published = statOrder.filter((id) => !withheld.has(metrics[id].value));
  const stats = (published.length >= 2 ? published : statOrder).slice(0, 4);
  const languages = [...profile.languages].filter((language) => language.percentage > 0).sort((a, b) => b.percentage - a.percentage).slice(0, 5);
  const href = live ? `/u/${profile.username}` : "/example";

  return (
    <article className="example-profile relative" aria-label={`${live ? "Live public profile" : "Example profile"}: ${name}`}>
      <Crosshair className="example-mark example-mark-tl" />
      <Crosshair className="example-mark example-mark-br" />
      <div className="flex items-center justify-between gap-4 border-b border-[#24241f] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#858177] sm:px-6">
        <span>{live ? "Live public profile" : "Example profile · representative"}</span>
        <span className="normal-case tracking-normal text-[#55a7ff]">/u/{profile.username}</span>
      </div>

      <div className="flex items-start gap-5 px-4 py-6 sm:px-6 sm:py-7">
        <Avatar name={name} src={profile.avatar_url} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-[family-name:var(--font-profile-editorial)] text-3xl leading-tight tracking-[-0.03em] text-[#edeae0] sm:text-4xl">{name}</h3>
          <p className="mt-1 font-mono text-xs text-[#55a7ff]">@{profile.username}</p>
          {profile.bio && <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-6 text-[#aaa69a]">{profile.bio}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-2 border-t border-[#2b2a24] sm:grid-cols-4">
        {stats.map((id, index) => (
          <div key={id} className={`min-w-0 border-[#2b2a24] px-4 py-4 sm:px-6 sm:py-5 ${index % 2 ? "border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""} ${index === 2 ? "sm:border-l" : ""}`}>
            <dd className="truncate font-mono text-lg tabular-nums tracking-[-0.03em] text-[#edeae0] sm:text-xl">{metrics[id].value}</dd>
            <dt className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#858177]">{metrics[id].label}</dt>
          </div>
        ))}
      </dl>

      {languages.length > 0 && (
        <div className="border-t border-[#2b2a24] px-4 py-5 sm:px-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#969287]">Language activity</p>
          <div className="mt-3 flex h-1.5 overflow-hidden bg-[#24231e]" role="img" aria-label={languages.map((language) => `${getLanguageDisplayName(language.name)} ${formatPercentage(language.percentage)}`).join(", ")}>
            {languages.map((language, index) => (
              <span key={language.id} className="h-full" style={{ width: `${Math.min(100, language.percentage)}%`, backgroundColor: languageColors[index] }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10px] text-[#858177]" aria-hidden="true">
            {languages.map((language, index) => (
              <li key={language.id} className="inline-flex items-center gap-1.5">
                <span className="inline-block size-1.5" style={{ backgroundColor: languageColors[index] }} />
                {getLanguageDisplayName(language.name)} {formatPercentage(language.percentage)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-[#24241f] px-4 py-3 sm:px-6">
        <Link href={href} className="inline-flex min-h-10 items-center gap-2 font-mono text-xs text-[#55a7ff] underline decoration-[#3f668a] underline-offset-4 transition hover:text-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]">
          {live ? `View @${profile.username}` : "View the example profile"} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
