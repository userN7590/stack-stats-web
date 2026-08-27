import { Logo } from "@/components/ui/logo";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#11110d] text-[#edeae0]">
      <nav className="border-b border-[#2b2a24]">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Logo />
        </div>
      </nav>
      <div className="mx-auto max-w-5xl animate-pulse px-5 py-12 sm:px-8">
        <div className="h-3 w-28 bg-[#24231e]" />
        <div className="mt-5 h-9 w-80 max-w-full bg-[#24231e]" />
        <div className="mt-4 h-4 w-[30rem] max-w-full bg-[#1d1d18]" />
        {["one", "two", "three"].map((item) => (
          <div
            key={item}
            className="mt-7 h-72 border-t border-[#2b2a24] bg-[#141410]"
          />
        ))}
      </div>
    </main>
  );
}
