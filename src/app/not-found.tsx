import Link from "next/link";

import { AppNavbar } from "@/components/ui/app-navbar";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#11110d] text-[#edeae0]">
      <AppNavbar>
        <Link href="/" className="font-mono text-xs text-[#aaa69a] hover:text-[#edeae0]">
          Home
        </Link>
      </AppNavbar>
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-5 text-center">
        <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#55a7ff]">
          404
        </p>
        <h1 className="mt-3 [font-family:Georgia,'Times_New_Roman',serif] text-3xl">Page not found</h1>
        <p className="mt-3 text-sm text-[#969287]">The page you requested does not exist.</p>
        <Link href="/" className="mt-7 inline-flex rounded-[3px] bg-[#55a7ff] px-4 py-2.5 font-mono text-xs font-semibold text-[#0b1722]">
          Return home
        </Link>
        </div>
      </div>
    </main>
  );
}
