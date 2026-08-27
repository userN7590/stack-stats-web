import type { ReactNode } from "react";
import Link from "next/link";

import { AppNavbar } from "@/components/ui/app-navbar";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  alternateHref,
  alternateLabel,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#11110d] text-[#edeae0]">
      <AppNavbar>
        <Link
          href={alternateHref}
          className="border border-[#3b3931] px-3 py-2 font-mono text-xs text-[#edeae0] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
        >
          {alternateLabel}
        </Link>
      </AppNavbar>

      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-4xl">

          <section className="grid border-y border-[#2b2a24] md:grid-cols-[0.86fr_1.14fr]">
            <header className="border-b border-[#2b2a24] py-8 md:border-b-0 md:border-r md:py-10 md:pr-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
                {eyebrow}
              </p>
              <h1 className="mt-4 [font-family:Georgia,'Times_New_Roman',serif] text-3xl leading-tight text-[#edeae0] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-[#969287]">
                {description}
              </p>
            </header>

            <div className="py-8 md:py-10 md:pl-10">{children}</div>
          </section>

          <p className="mt-6 max-w-md font-mono text-[10px] leading-5 text-[#77746b]">
            Profile content becomes public after you save it. Authentication
            credentials remain private.
          </p>
        </div>
      </div>
    </main>
  );
}
