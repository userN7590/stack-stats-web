import { Logo } from "@/components/ui/logo";

export default function ProfileLoading() {
  return (
    <main className="min-h-screen bg-[#070a09] text-zinc-100">
      <nav className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Logo />
        </div>
      </nav>
      <div className="mx-auto max-w-6xl animate-pulse px-5 py-12 sm:px-8 sm:py-16">
        <div className="h-52 rounded-3xl border border-white/[0.05] bg-white/[0.025]" />
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {["one", "two", "three", "four", "five", "six"].map((item) => (
            <div key={item} className="h-28 rounded-2xl bg-white/[0.025]" />
          ))}
        </div>
      </div>
    </main>
  );
}
