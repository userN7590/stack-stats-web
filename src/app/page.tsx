import {
  ArrowRight,
  Check,
  Clock3,
  Code2,
  FileCode2,
  GitBranch,
  Plus,
  Share2,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

const steps = [
  {
    number: "01",
    title: "Create your account",
    description: "Sign up with email and choose the profile details you want to share.",
    icon: UserRound,
  },
  {
    number: "02",
    title: "Add your totals",
    description: "Enter aggregate stats and a language breakdown on your schedule.",
    icon: SlidersHorizontal,
  },
  {
    number: "03",
    title: "Share one clean link",
    description: "Send a responsive public profile to teammates, clients, or recruiters.",
    icon: Share2,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070a09] text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[52rem] overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-28rem] size-[58rem] -translate-x-1/2 rounded-full border border-emerald-300/10 bg-emerald-400/[0.07] blur-[100px]" />
        <div className="hero-grid absolute inset-0 opacity-50" />
      </div>

      <nav className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3.5 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-300/35 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Create profile
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative z-[1] mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.03fr_0.97fr] lg:gap-16 lg:pb-32 lg:pt-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" />
            Your work, clearly presented
          </div>
          <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            Your coding story,
            <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
              in numbers.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
            Stack Stats turns the aggregate coding statistics you enter into a
            polished public developer profile—simple to update and easy to share.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-[#07110d] shadow-[0_12px_40px_rgba(52,211,153,0.16)] transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070a09]"
            >
              Create your profile
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/example"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              View example profile
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-400" /> Email sign-in
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-400" /> You control the data
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-400" /> Public share link
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="absolute -inset-8 rounded-[2.5rem] bg-emerald-400/[0.04] blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c100e]/95 shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
            <div className="flex h-10 items-center gap-1.5 border-b border-white/[0.06] px-4">
              <span className="size-2 rounded-full bg-zinc-700" />
              <span className="size-2 rounded-full bg-zinc-700" />
              <span className="size-2 rounded-full bg-emerald-500/60" />
              <span className="ml-3 font-mono text-[10px] text-zinc-700">stackstats.dev/u/alex</span>
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/20 to-cyan-300/5 font-mono text-sm font-semibold text-emerald-200">
                  AR
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-zinc-100">Alex Rivera</h2>
                      <p className="mt-0.5 font-mono text-[11px] text-emerald-300/70">@alex</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] p-2 text-zinc-500">
                      <GitBranch className="size-3.5" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Product-minded engineer building thoughtful tools for the web.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  { label: "Lines added", value: "184,290", icon: Plus, tone: "text-emerald-300" },
                  { label: "Files", value: "2,481", icon: FileCode2, tone: "text-cyan-300" },
                  { label: "Coding time", value: "642h", icon: Clock3, tone: "text-violet-300" },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <Icon className={`size-3.5 ${stat.tone}`} />
                      <p className="mt-3 truncate font-mono text-sm font-semibold text-zinc-200 sm:text-base">{stat.value}</p>
                      <p className="mt-1 truncate text-[9px] text-zinc-600 sm:text-[10px]">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Code2 className="size-3.5 text-zinc-600" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Languages</span>
                </div>
                {[
                  ["TypeScript", "62%", "w-[62%] bg-emerald-400"],
                  ["Python", "24%", "w-[24%] bg-cyan-400"],
                  ["CSS", "14%", "w-[14%] bg-violet-400"],
                ].map(([name, percentage, width]) => (
                  <div className="mb-3 last:mb-0" key={name}>
                    <div className="mb-1.5 flex justify-between text-[10px] text-zinc-500">
                      <span>{name}</span>
                      <span className="font-mono">{percentage}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06]">
                      <div className={`h-full rounded-full ${width}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300/70">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
              From totals to profile in minutes.
            </h2>
            <p className="mt-4 leading-7 text-zinc-500">
              No source-code access and no background tracking. You enter the
              aggregate numbers you want visitors to see.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="group rounded-2xl border border-white/[0.07] bg-[#0a0e0c] p-6 transition hover:border-emerald-300/15">
                  <div className="flex items-center justify-between">
                    <div className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-emerald-300">
                      <Icon className="size-4" />
                    </div>
                    <span className="font-mono text-[10px] text-zinc-700">{step.number}</span>
                  </div>
                  <h3 className="mt-7 font-semibold text-zinc-200">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{step.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="overflow-hidden rounded-3xl border border-emerald-300/10 bg-gradient-to-br from-emerald-400/[0.08] via-[#0b100e] to-cyan-400/[0.04] px-6 py-12 text-center sm:px-10 sm:py-16">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Build a profile worth sharing.</h2>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-zinc-500">Start with the stats you have today. Edit the profile whenever your totals change.</p>
          <Link href="/signup" className="group mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-[#07110d] transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b100e]">
            Get started
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <footer className="relative border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-7 text-xs text-zinc-700 sm:flex-row sm:px-8">
          <Logo />
          <p>Public developer profiles, maintained by developers.</p>
        </div>
      </footer>
    </main>
  );
}
