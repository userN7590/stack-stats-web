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
    <main className="flex min-h-screen items-center justify-center bg-[#11110d] px-5 py-10 text-[#edeae0] sm:px-8">
      <div className="w-full max-w-4xl">
        <div className="mb-9">
          <Logo wordmarkOnly />
        </div>

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
    </main>
  );
}
