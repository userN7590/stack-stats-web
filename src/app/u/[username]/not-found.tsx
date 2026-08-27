import { SearchX } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function ProfileNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#11110d] px-5 text-[#edeae0]">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="border-y border-[#2b2a24] py-8">
          <div className="mx-auto grid size-12 place-items-center border border-[#34332c] text-[#77746b]">
            <SearchX className="size-5" />
          </div>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-[#55a7ff]">
            404 · Profile not found
          </p>
          <h1 className="mt-3 [font-family:Georgia,'Times_New_Roman',serif] text-2xl">
            This developer is not here yet.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#969287]">
            The username may be incorrect, or the profile may not have been
            created.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-[3px] border border-[#3b3931] px-4 font-mono text-xs text-[#c8c4b9] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
            >
              Back home
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-[#55a7ff] px-4 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
            >
              Create your profile
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
