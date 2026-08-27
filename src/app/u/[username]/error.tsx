"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function ProfileError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070a09] px-5 text-center text-zinc-100">
      <div className="max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8">
          <AlertTriangle className="mx-auto size-8 text-amber-300" />
          <h1 className="mt-5 text-2xl font-semibold">Profile unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Stack Stats could not load this profile. Please try again in a moment.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300">
              Home
            </Link>
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-[#07110d]">
              <RefreshCw className="size-4" /> Try again
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
