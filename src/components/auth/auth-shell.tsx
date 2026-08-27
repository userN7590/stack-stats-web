import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#070a09] px-5 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-[-24rem] size-[48rem] -translate-x-1/2 rounded-full bg-emerald-400/[0.08] blur-[110px]" />
        <div className="profile-grid absolute inset-0 opacity-30" />
      </div>

      <div className="relative z-[1] w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0c100e]/95 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
          <div className="p-6 sm:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
            <div className="mt-7">{children}</div>
          </div>
        </section>
        <p className="mt-6 text-center text-xs leading-5 text-zinc-700">
          Your profile content becomes public after you save it.
          <br />Your authentication credentials do not.
        </p>
      </div>
    </main>
  );
}
