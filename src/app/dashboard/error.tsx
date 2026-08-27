"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#11110d] px-5 text-[#edeae0]">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="border-y border-[#2b2a24] py-8">
          <div className="mx-auto grid size-12 place-items-center border border-[#55482e] text-[#d8aa54]">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="mt-5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl">
            Could not load your dashboard
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#969287]">
            Check your Supabase configuration and database migration, then try
            again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-[3px] border border-[#3b3931] px-4 font-mono text-xs text-[#c8c4b9] hover:border-[#55a7ff] hover:text-[#55a7ff]"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-[#55a7ff] px-4 font-mono text-xs font-semibold text-[#0b1722] hover:bg-[#78b8ff]"
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
