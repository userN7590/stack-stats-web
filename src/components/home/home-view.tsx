import { ArrowRight, LogIn, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";

import { Annotated, SketchBrace } from "@/components/annotations/sketch";
import { LogoutButton } from "@/components/auth/logout-button";
import { ExtensionCta } from "@/components/home/extension-cta";
import { HomeFingerprint } from "@/components/home/home-fingerprint";
import { ProfileCards } from "@/components/home/profile-cards";
import { AppNavbar } from "@/components/ui/app-navbar";
import { Logo } from "@/components/ui/logo";
import { GridSignal } from "@/components/ui/grid-signal";
import { GridPulse, RuleSection } from "@/components/ui/structure";
import type { PublicProfile } from "@/lib/types";

export type HomeViewer = { signedIn: boolean; username: string | null };
export type HomeExample = { profile: PublicProfile; live: boolean };

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#11110d]";
const primaryButton = `group inline-flex min-h-11 items-center justify-center gap-2 bg-[#55a7ff] px-5 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] ${focusRing}`;
const quietLink = `inline-flex min-h-10 items-center gap-2 font-mono text-xs text-[#55a7ff] underline decoration-[#3f668a] underline-offset-4 transition hover:text-[#78b8ff] ${focusRing}`;

/**
 * Homepage: show, don't explain. Headline and profile cards say what Stack
 * Stats is; the fingerprint shows what your activity becomes. Server-rendered
 * and identical for every visitor except CTA wording and an owner-only
 * control on the fingerprint. Private data is never part of this markup.
 */
export function HomeView({ viewer, example }: { viewer: HomeViewer; example: HomeExample }) {
  const primaryHref = viewer.username ? `/u/${viewer.username}` : viewer.signedIn ? "/dashboard" : "/signup";
  const primaryLabel = viewer.username ? `View /u/${viewer.username}` : viewer.signedIn ? "Set up your profile" : "Create your profile";
  const secondary = viewer.username === example.profile.username && example.live ? null
    : example.live ? { href: `/u/${example.profile.username}`, label: `View @${example.profile.username}’s profile` } : { href: "/example", label: "View example profile" };
  // Two entry paths: profile first (primary) or tracking first in VS Code.
  const actions = (
    <div className="hero-actions">
      <Link href={primaryHref} className={primaryButton}>
        {primaryLabel}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <ExtensionCta />
    </div>
  );

  // Statistics and fingerprint share one client island so they always
  // describe the same data (example, or the owner's own after a click).
  const activity = (
    <RuleSection label="Activity" frameClassName="activity-frame">
      <GridPulse edge="right" delay={19} />
      <HomeFingerprint
        signedIn={viewer.signedIn}
        intro={
          <div className="md:col-span-2">
            <p className="section-label">Activity</p>
            <h2 className="section-title mt-4">Your work leaves a pattern.</h2>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[#969287]">Every ridge is one day of coding, hour by hour.</p>
          </div>
        }
      />
    </RuleSection>
  );

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

      <GridSignal />
      <RuleSection guides marks rulePulse={11} label="Introduction" frameClassName="hero-frame">
        <GridPulse edge="left" delay={3} />
        <div className="site-inset relative z-10 pt-12 sm:pt-16 lg:pt-20">
          <h1 className="hero-title" data-hero-title="">
            <span>Your{" "}<Annotated marks={<><SketchBrace side="left" className="hero-brace hero-brace-left" delay={650} /><SketchBrace side="right" className="hero-brace hero-brace-right" delay={900} /></>}>development.</Annotated></span>
            <span>One profile.</span>
          </h1>
        </div>
        <div className="hero-body site-inset pb-12 sm:pb-14">
          <div className="hero-lede">
            <p className="text-base leading-7 text-[#c8c4b9] sm:text-lg sm:leading-8">
              Stack Stats tracks your coding in VS Code and turns it into a profile you can share.
            </p>
            <div className="mt-7">{actions}</div>
            {secondary && <Link href={secondary.href} className={`mt-4 ${quietLink}`}>{secondary.label} <span aria-hidden="true">→</span></Link>}
          </div>
          <div className="hero-cards"><ProfileCards profile={example.profile} live={example.live} /></div>
        </div>
      </RuleSection>

      {activity}

      <RuleSection label="Get started" marks>
        <div className="final-cta site-inset">
          <h2 className="section-title">What does your coding look like?</h2>
          {actions}
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
