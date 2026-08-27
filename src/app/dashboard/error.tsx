"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070a09] px-5 text-zinc-100">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8">
          <div className="mx-auto grid size-12 place-items-center rounded-xl border border-amber-300/15 bg-amber-400/[0.07] text-amber-200">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Could not load your dashboard
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Check your Supabase configuration and database migration, then try
            again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-zinc-300 hover:border-white/20 hover:text-white"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-[#07110d] hover:bg-emerald-200"
            >
              <RefreshCw className="size-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
