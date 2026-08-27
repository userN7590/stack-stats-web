import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#11110d] px-5 text-center text-[#edeae0]">
      <div>
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#55a7ff]">
          404
        </p>
        <h1 className="mt-3 [font-family:Georgia,'Times_New_Roman',serif] text-3xl">Page not found</h1>
        <p className="mt-3 text-sm text-[#969287]">The page you requested does not exist.</p>
        <Link href="/" className="mt-7 inline-flex rounded-[3px] bg-[#55a7ff] px-4 py-2.5 font-mono text-xs font-semibold text-[#0b1722]">
          Return home
        </Link>
      </div>
    </main>
  );
}
