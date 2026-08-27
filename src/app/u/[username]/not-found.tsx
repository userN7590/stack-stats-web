import { SearchX } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function ProfileNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070a09] px-5 text-zinc-100">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8">
          <div className="mx-auto grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-500">
            <SearchX className="size-5" />
          </div>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-zinc-600">
            404 · Profile not found
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            This developer is not here yet.
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            The username may be incorrect, or the profile may not have been
            created.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Back home
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-[#07110d] transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Create your profile
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
