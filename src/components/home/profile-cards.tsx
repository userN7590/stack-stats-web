import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { CardStack } from "@/components/home/card-stack";
import { Avatar } from "@/components/profile/avatar";
import {
  buildFingerprint,
  cardLayout,
  depthInk,
  fingerprintFrame,
  formatUtcHour,
  ridgeHeights,
  ridgePath,
  type FingerprintLayout,
  type FingerprintModel,
} from "@/lib/activity-fingerprint";
import { exampleDevelopers, type ExampleDeveloper } from "@/lib/example-developers";
import { formatDurationMs, formatPercentage, getInitials } from "@/lib/format";
import { getLanguageDisplayName } from "@/lib/language-display";
import { publicMetricState } from "@/lib/profile-content";
import { getProfileMetrics } from "@/lib/profile-metrics";
import type { StatId } from "@/lib/profile-layout";
import type { HourlyActivity } from "@/lib/sync-datasets";
import type { PublicProfile } from "@/lib/types";

const languageColors = ["#55a7ff", "#65c58f", "#d8aa54", "#a58bd4", "#77746b"];
const statOrder: StatId[] = ["coding_minutes", "lines_added", "edit_events", "files_changed", "lines_removed", "projects_count"];
const withheld = new Set(["Not published", "Unavailable"]);

/**
 * Desktop resting fan, in visual order (back-left → front-right). `y` is in
 * rise units, `r` in degrees; the live card is last (front) and 10% larger.
 * Four cards (not five) give every example about half its width as a stable
 * target; see docs/PHASE-9D2-HOMEPAGE.md for the comparison.
 */
const fan = { stepRatio: 0.47, frontScale: 1.1, slots: [{ y: 3.3, r: -5 }, { y: 2.2, r: -2.4 }, { y: 1.1, r: 2.2 }, { y: 0, r: -1.2 }] };

type Stat = { value: string; label: string };
type Card = {
  key: string;
  href?: string;
  path: string;
  tag: string;
  live: boolean;
  name: string;
  username: string;
  bio: string | null;
  avatar: ReactNode;
  primary: Stat;
  secondary: Stat[];
  visual: ReactNode;
  languages: { name: string; percentage: number }[];
};

/** Static miniature ridgeline (no interaction, server-rendered). */
export function MiniFingerprint({ model, layout = cardLayout, label }: { model: FingerprintModel; layout?: FingerprintLayout; label: string }) {
  const frame = fingerprintFrame(model, layout);
  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="pcard-fp" role="img" aria-label={label}>
      {model.ridges.map((ridge, index) => ridge.status === "observed" && (
        <path key={ridge.date} d={ridgePath(frame, frame.ridges[index], ridgeHeights(ridge, model, layout))} stroke={depthInk(index, model.ridges.length)} />
      ))}
    </svg>
  );
}

function liveCard(profile: PublicProfile, live: boolean): Card {
  const name = profile.display_name || profile.username;
  const metrics = getProfileMetrics(profile);
  const published = statOrder.filter((id) => !withheld.has(metrics[id].value));
  const stats = (published.length ? published : statOrder).slice(0, 3).map((id) => ({ value: metrics[id].value, label: metrics[id].label }));
  const languages = [...profile.languages].filter((language) => language.percentage > 0).sort((a, b) => b.percentage - a.percentage).slice(0, 4)
    .map((language) => ({ name: getLanguageDisplayName(language.name), percentage: Math.min(100, language.percentage) }));
  // Published 24-bin UTC aggregate only: public profiles have no day × hour rows.
  const hourly = publicMetricState(profile, "schedule.hourly_utc");
  const bins = hourly.status === "ready" ? (hourly.metric!.dataset as HourlyActivity).activeMsByHour : null;
  const aggregate = bins && bins.some((value) => value > 0) ? buildFingerprint([{ date: "2000-01-01", hours: bins }]) : null;
  return {
    key: `live-${profile.username}`,
    href: live ? `/u/${profile.username}` : "/example",
    path: live ? `/u/${profile.username}` : "Example profile",
    tag: live ? "Live" : "Example",
    live,
    name,
    username: profile.username,
    bio: profile.bio,
    avatar: <span className="pcard-avatar"><Avatar name={name} src={profile.avatar_url} size="card" /></span>,
    primary: stats[0] ?? { value: "—", label: "No published stats" },
    secondary: stats.slice(1),
    visual: aggregate
      ? <MiniFingerprint model={aggregate} layout={{ ...cardLayout, height: 48, amplitude: 38, padTop: 4 }} label="Published UTC hour-of-day activity, all published days combined" />
      : languages.length ? <LanguageBar languages={languages} /> : null,
    languages,
  };
}

function exampleCard(developer: ExampleDeveloper): Card {
  return {
    key: developer.key,
    path: "Example profile",
    tag: "Example",
    live: false,
    name: developer.name,
    username: developer.username,
    bio: developer.bio,
    avatar: <span aria-hidden="true" className="pcard-initials" style={{ color: developer.tone }}>{getInitials(developer.name)}</span>,
    primary: { value: formatDurationMs(developer.codingMs), label: "Coding time · 14 days" },
    secondary: [
      { value: `${developer.activeDates}/${developer.fingerprint.ridges.length}`, label: "Active dates" },
      { value: developer.peakHour === null ? "—" : `${formatUtcHour(developer.peakHour)}`, label: "Peak hour, UTC" },
    ],
    visual: <MiniFingerprint model={developer.fingerprint} label={`${developer.name}: example two-week activity fingerprint`} />,
    languages: [...developer.languages],
  };
}

function LanguageBar({ languages }: { languages: { name: string; percentage: number }[] }) {
  return (
    <div className="pcard-bar" role="img" aria-label={languages.map((language) => `${language.name} ${formatPercentage(language.percentage)}`).join(", ")}>
      {languages.map((language, index) => <span key={language.name} style={{ width: `${language.percentage}%`, backgroundColor: languageColors[index] }} />)}
    </div>
  );
}

function ProfileCard({ card, position, slot, front }: { card: Card; position: number; slot: { y: number; r: number }; front: boolean }) {
  const style = { "--pos": position, "--y": slot.y, "--r": `${slot.r}deg`, "--z": front ? 5 : position + 1 } as CSSProperties;
  const body = (
    <>
      <div className="pcard-strip">
        <span className="truncate">{card.path}</span>
        <span className={card.live ? "pcard-tag pcard-tag-live" : "pcard-tag"}>{card.tag}</span>
      </div>
      <div className="pcard-id">
        {card.avatar}
        <div className="min-w-0">
          <p className="pcard-name">{card.name}</p>
          <p className="pcard-handle">@{card.username}</p>
        </div>
      </div>
      {card.bio && <p className="pcard-bio">{card.bio}</p>}
      <div className="pcard-primary">
        <p className="pcard-value">{card.primary.value}</p>
        <p className="pcard-label">{card.primary.label}</p>
      </div>
      {card.secondary.length > 0 && (
        <dl className="pcard-secondary">
          {card.secondary.map((stat) => (
            <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>
          ))}
        </dl>
      )}
      {card.visual && <div className="pcard-visual">{card.visual}</div>}
      {card.languages.length > 0 && <p className="pcard-langs">{card.languages.slice(0, 3).map((language) => language.name).join(" · ")}</p>}
    </>
  );
  return (
    <li className={`pcard${front ? " pcard-front" : ""}`} style={style} data-profile-card={card.key} data-card-pos={position}>
      {card.href
        ? <Link href={card.href} className="pcard-body">{body}</Link>
        // Focusable so keyboard users can bring each example forward (Enter/Space locks it).
        : <article className="pcard-body" tabIndex={0} aria-label={`Example profile (fictional): ${card.name}`}>{body}</article>}
    </li>
  );
}

/**
 * Overlapping developer profile cards. The front card is the real public
 * profile (same approved projection as its page) or, if unavailable, the
 * labelled example persona. The rest are fictional, labelled examples.
 * DOM order is live card first (reading, tab and phone-strip order); the
 * desktop fan places it front-right via `--pos`.
 */
export function ProfileCards({ profile, live }: { profile: PublicProfile; live: boolean }) {
  const cards = [liveCard(profile, live), ...exampleDevelopers.map(exampleCard)];
  const count = cards.length;
  const style = { "--n": count, "--step-ratio": fan.stepRatio, "--front-scale": fan.frontScale, "--ymax": fan.slots[0].y } as CSSProperties;
  return (
    <CardStack label="Developer profile cards" style={style}>
      {cards.map((card, index) => {
        const position = index === 0 ? count - 1 : index - 1;
        return <ProfileCard key={card.key} card={card} position={position} slot={fan.slots[position]} front={index === 0} />;
      })}
    </CardStack>
  );
}
