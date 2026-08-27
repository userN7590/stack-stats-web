"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

import { AppNavbar } from "@/components/ui/app-navbar";

export default function ProfileError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#11110d] text-[#edeae0]">
      <AppNavbar>
        <Link href="/" className="font-mono text-xs text-[#aaa69a] hover:text-[#edeae0]">
          Home
        </Link>
      </AppNavbar>
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-5 text-center">
        <div className="max-w-md">
        <div className="border-y border-[#2b2a24] py-8">
          <AlertTriangle className="mx-auto size-8 text-[#d8aa54]" />
          <h1 className="mt-5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl">Profile unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-[#969287]">
            Stack Stats could not load this profile. Please try again in a moment.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="rounded-[3px] border border-[#3b3931] px-4 py-2.5 font-mono text-xs text-[#c8c4b9]">
              Home
            </Link>
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-[3px] bg-[#55a7ff] px-4 py-2.5 font-mono text-xs font-semibold text-[#0b1722]">
              <RefreshCw className="size-4" /> Try again
            </button>
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}
