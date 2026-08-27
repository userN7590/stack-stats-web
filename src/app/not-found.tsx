import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070a09] px-5 text-center text-zinc-100">
      <div>
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-300/60">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm text-zinc-500">The page you requested does not exist.</p>
        <Link href="/" className="mt-7 inline-flex rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-[#07110d]">
          Return home
        </Link>
      </div>
    </main>
  );
}
