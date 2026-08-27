import { Logo } from "@/components/ui/logo";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#070a09] text-zinc-100">
      <nav className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Logo />
        </div>
      </nav>
      <div className="mx-auto max-w-5xl animate-pulse px-5 py-12 sm:px-8">
        <div className="h-3 w-28 rounded bg-white/[0.05]" />
        <div className="mt-5 h-9 w-80 max-w-full rounded bg-white/[0.06]" />
        <div className="mt-4 h-4 w-[30rem] max-w-full rounded bg-white/[0.04]" />
        {["one", "two", "three"].map((item) => (
          <div
            key={item}
            className="mt-7 h-72 rounded-2xl border border-white/[0.05] bg-white/[0.02]"
          />
        ))}
      </div>
    </main>
  );
}
