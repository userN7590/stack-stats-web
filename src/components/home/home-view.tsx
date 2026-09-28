import { ArrowRight, LogIn, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";

import { Annotated, SketchArrow, SketchBrace, SketchNodeLoop, SketchUnderline } from "@/components/annotations/sketch";
import { LogoutButton } from "@/components/auth/logout-button";
import { FingerprintMatrix, matrixGeometry } from "@/components/fingerprint/fingerprint-matrix";
import { ExampleProfile } from "@/components/home/example-profile";
import { HomeFingerprint } from "@/components/home/home-fingerprint";
import { AppNavbar } from "@/components/ui/app-navbar";
import { Logo } from "@/components/ui/logo";
import { RuleSection, SectionIndex } from "@/components/ui/structure";
import { FINGERPRINT_HOURS, formatUtcHourRange, representativeFingerprint, summarizeFingerprint } from "@/lib/activity-fingerprint";
import { formatDurationMs } from "@/lib/format";
import type { PublicProfile } from "@/lib/types";

export type HomeViewer = { signedIn: boolean; username: string | null };
export type HomeExample = { profile: PublicProfile; live: boolean };

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#11110d]";
const quietLink = `font-mono text-xs text-[#55a7ff] underline decoration-[#3f668a] underline-offset-4 transition hover:text-[#78b8ff] ${focusRing}`;

const pipeline = [
  { label: "Editor", text: "The local-first VS Code extension records activity on your machine as you work. No timers, no manual logging." },
  { label: "Daily aggregate", text: "Each day becomes counters: coding time, content changes, lines, languages and sessions." },
  { label: "Private sync", text: "Uploads start only after a separate approval, and stay private by default." },
  { label: "Your selection", text: "You publish metric by metric. Everything unselected stays private." },
];
const uploaded = ["Evidence-backed coding time", "Content changes and lines added/removed", "File-day, session and language counts", "Opaque project totals", "UTC hours: optional, off by default"];
const neverUploaded = ["Source code", "File names", "Prompts", "Raw editor events", "Project names"];

/**
 * Homepage composition. Server-rendered and identical for every visitor except
 * the CTA wording and an owner-only control on the fingerprint. Private data is
 * never part of this markup.
 */
export function HomeView({ viewer, example }: { viewer: HomeViewer; example: HomeExample }) {
  const model = representativeFingerprint();
  const summary = summarizeFingerprint(model);
  const activeDates = model.ridges.filter((ridge) => ridge.status === "observed" && ridge.total! > 0).length;
  const primaryHref = viewer.username ? `/u/${viewer.username}` : viewer.signedIn ? "/dashboard" : "/signup";
  const primaryLabel = viewer.username ? "View your profile" : viewer.signedIn ? "Set up your profile" : "Create your profile";
  const matrixWidth = matrixGeometry.label + FINGERPRINT_HOURS * matrixGeometry.cell;
  const busiestLeft = summary.busiestHour === null ? null : (matrixGeometry.label + (summary.busiestHour + 0.5) * matrixGeometry.cell) / matrixWidth * 100;
  const stats = [
    { value: formatDurationMs(summary.total), label: "Coding time, 30 days" },
    { value: `${activeDates} of ${model.ridges.length}`, label: "Dates with activity" },
    { value: summary.busiestHour === null ? "—" : formatUtcHourRange(summary.busiestHour), label: "Busiest hour" },
    { value: summary.busiestDay ? formatDurationMs(summary.busiestDay.total!) : "—", label: "Longest day" },
  ];

  return (
    <main className="overflow-x-hidden bg-[#11110d] text-[#edeae0]">
      <AppNavbar rails>
        <div className="flex items-center gap-3 font-mono text-xs sm:gap-4">
          {viewer.signedIn ? (
            <>
              <Link
                href={viewer.username ? `/u/${viewer.username}` : "/dashboard"}
                aria-label={viewer.username ? "Your profile" : "Set up profile"}
                className="inline-flex size-10 items-center justify-center border border-[#3b3931] text-[#edeae0] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] sm:h-auto sm:w-auto sm:px-3 sm:py-2"
              >
                {viewer.username ? <UserRound className="size-4 sm:hidden" /> : <UserPlus className="size-4 sm:hidden" />}
                <span className="sr-only sm:not-sr-only">{viewer.username ? "Your profile" : "Set up profile"}</span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" aria-label="Log in" className="inline-flex size-10 items-center justify-center text-[#aaa69a] transition hover:text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] sm:size-auto">
                <LogIn className="size-4 sm:hidden" />
                <span className="sr-only sm:not-sr-only">Log in</span>
              </Link>
              <Link href="/signup" aria-label="Create profile" className="inline-flex size-10 items-center justify-center border border-[#3b3931] text-[#edeae0] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] sm:h-auto sm:w-auto sm:px-3 sm:py-2">
                <UserPlus className="size-4 sm:hidden" />
                <span className="sr-only sm:not-sr-only">Create profile</span>
              </Link>
            </>
          )}
        </div>
      </AppNavbar>

      <RuleSection guides marks label="Introduction" frameClassName="hero-frame">
        <div className="site-inset relative z-10 pt-12 sm:pt-16 lg:pt-20">
          <h1 className="hero-title" data-hero-title="">
            <span>Your{" "}<Annotated marks={<><SketchBrace side="left" className="hero-brace hero-brace-left" delay={650} /><SketchBrace side="right" className="hero-brace hero-brace-right" delay={900} /></>}>development.</Annotated></span>
            <span>One{" "}<Annotated marks={<SketchNodeLoop className="hero-loop" delay={1050} />}>profile</Annotated>.</span>
          </h1>
        </div>
        <div className="hero-body site-inset pb-10 sm:pb-12">
          <div className="hero-lede">
            <p className="text-base leading-7 text-[#c8c4b9] sm:text-lg sm:leading-8">
              Create a public profile for the work behind your code.
            </p>
            <p className="mt-3 text-sm leading-6 text-[#969287]">
              Stack Stats turns everyday editor activity into statistics you choose to publish.
            </p>
            <div className="mt-7 flex flex-col items-start gap-4">
              <Link href={primaryHref} className={`group inline-flex min-h-11 items-center justify-center gap-2 bg-[#55a7ff] px-5 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] ${focusRing}`}>
                {primaryLabel}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {viewer.username !== "fil" && (
                <Link href="/u/fil" className={`inline-flex min-h-10 items-center ${quietLink}`}>View @fil’s profile</Link>
              )}
            </div>
          </div>
          <div className="hero-figure">
            <HomeFingerprint signedIn={viewer.signedIn} />
          </div>
        </div>
      </RuleSection>

      <RuleSection label="Capture">
        <div className="site-grid">
          <div className="site-inset py-14 md:col-span-2 md:py-20">
            <SectionIndex index="01">Capture</SectionIndex>
            <h2 className="section-title mt-5">
              Development activity, captured{" "}
              <Annotated marks={<SketchUnderline className="underline-mark" tone="pencil" draw="view" />}>quietly</Annotated>.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#969287]">
              Stack Stats works in the background of your editor. You write code; it keeps count. Nothing leaves your machine until you approve it.
            </p>
          </div>
          <div className="min-w-0 border-t border-[#24241f] md:col-span-4 md:border-l md:border-t-0">
            <ol className="pipeline" aria-label="From editor to profile">
              {pipeline.map((step, index) => (
                <li key={step.label}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#edeae0]"><span className="text-[#55a7ff]">{String(index + 1).padStart(2, "0")}</span> {step.label}</p>
                  <p className="mt-3 text-[13px] leading-6 text-[#969287]">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="grid border-t border-[#24241f] sm:grid-cols-2">
              <div className="site-inset py-7">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#858177]">Uploaded as daily aggregates</p>
                <ul className="mt-4 space-y-2 font-mono text-xs text-[#c8c4b9]">
                  {uploaded.map((item) => <li key={item} className="flex gap-3"><span aria-hidden="true" className="text-[#55a7ff]">+</span>{item}</li>)}
                </ul>
              </div>
              <div className="site-inset border-t border-[#24241f] py-7 sm:border-l sm:border-t-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#858177]">Never uploaded</p>
                <ul className="mt-4 space-y-2 font-mono text-xs text-[#c8c4b9]">
                  {neverUploaded.map((item) => <li key={item} className="flex gap-3"><span aria-hidden="true" className="text-[#858177]">×</span>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </RuleSection>

      <RuleSection label="Measure">
        <div className="site-grid">
          <div className="site-inset py-14 md:col-span-2 md:py-20">
            <SectionIndex index="02">Measure</SectionIndex>
            <h2 className="section-title mt-5">Raw activity becomes meaningful statistics.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#969287]">
              The same thirty days, resolved into a readable chart. Every number comes from uploaded observations. A day with no record stays empty; it is never counted as zero.
            </p>
            <dl className="mt-8 border-t border-[#24241f]">
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-baseline justify-between gap-4 border-b border-[#24241f] py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#858177]">{stat.label}</dt>
                  <dd className="font-mono text-sm tabular-nums text-[#edeae0]">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 font-mono text-[10px] text-[#77746b]">Derived from the representative example above.</p>
          </div>
          <div className="min-w-0 border-t border-[#24241f] md:col-span-4 md:border-l md:border-t-0">
            <div className="site-inset py-14 md:py-20">
              <div className="matrix-scroll">
                <FingerprintMatrix
                  model={model}
                  dateStyle="relative"
                  title="Representative example: coding time by UTC date and hour"
                  overlay={busiestLeft !== null && (
                    <div aria-hidden="true">
                      {/* Static: view-timeline animation cannot run inside this horizontal scroller. */}
                      <SketchArrow direction="down" className="matrix-arrow" tone="pen" draw="none" style={{ left: `calc(${busiestLeft}% - 2.95rem)` }} />
                      <span className="matrix-note" style={{ left: `calc(${busiestLeft}% - 10.9rem)` }}>busiest hour</span>
                    </div>
                  )}
                />
              </div>
              <p className="mt-4 max-w-xl text-xs leading-6 text-[#aaa69a]">
                Rows are UTC dates; columns are UTC hours; brighter cells hold more coding time. Hours are never converted to a local time zone. A dash marks an observed hour with no activity.
              </p>
            </div>
          </div>
        </div>
      </RuleSection>

      <RuleSection label="Profile">
        <div className="site-grid">
          <div className="site-inset py-14 md:col-span-2 md:py-20">
            <SectionIndex index="03">Profile</SectionIndex>
            <h2 className="section-title mt-5">Statistics become a developer identity.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#969287]">
              Choose which numbers appear, arrange them on your profile’s grid, and share one link. Visitors see measured activity with its caveats attached, not a claim to take on trust.
            </p>
            <Link href="/example" className={`mt-6 inline-flex min-h-10 items-center gap-2 ${quietLink}`}>See a complete example profile <span aria-hidden="true">→</span></Link>
          </div>
          <div className="min-w-0 border-t border-[#24241f] md:col-span-4 md:border-l md:border-t-0 md:py-20">
            <div className="border-y border-[#2b2a24]">
              <ExampleProfile profile={example.profile} live={example.live} />
            </div>
          </div>
        </div>
      </RuleSection>

      <RuleSection guides marks label="Proof of work">
        <div className="site-grid">
          <div className="site-inset py-16 md:col-span-4 md:py-24">
            <SectionIndex index="04">Proof</SectionIndex>
            <h2 className="proof-title mt-6">Show real work, not just resume claims.</h2>
            <p className="mt-6 max-w-lg text-sm leading-7 text-[#969287]">
              Link your profile from a resume, a README or an application. It shows how you actually build: the hours, the languages, the consistency. You decide exactly what is public.
            </p>
            <Link href={primaryHref} className={`group mt-9 inline-flex min-h-11 items-center justify-center gap-2 bg-[#55a7ff] px-5 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] ${focusRing}`}>
              {primaryLabel}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <dl className="min-w-0 self-end border-t border-[#24241f] md:col-span-2 md:border-l md:border-t-0">
            {[
              ["Private by default", "Uploads need their own approval and stay private."],
              ["Metric by metric", "Publish only the numbers you select."],
              ["Revocable", "Disconnect editor access at any time."],
            ].map(([term, detail]) => (
              <div key={term} className="site-inset border-b border-[#24241f] py-5 last:border-b-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#edeae0]">{term}</dt>
                <dd className="mt-2 text-xs leading-5 text-[#969287]">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </RuleSection>

      <footer>
        <div className="site-frame site-inset flex flex-col gap-4 py-7 text-[11px] text-[#77746b] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Logo compact />
            <p>Public developer profiles.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 font-mono">
            <Link href="/example" className="underline decoration-[#444239] underline-offset-4 hover:text-[#edeae0]">Example profile</Link>
            <Link href="/u/fil" className="underline decoration-[#444239] underline-offset-4 hover:text-[#edeae0]">@fil</Link>
            {viewer.signedIn && <Link href="/settings/sync" className="underline decoration-[#444239] underline-offset-4 hover:text-[#edeae0]">Sync privacy</Link>}
          </nav>
        </div>
      </footer>
    </main>
  );
}
