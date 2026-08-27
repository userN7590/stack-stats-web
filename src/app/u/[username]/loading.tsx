import { Logo } from "@/components/ui/logo";

export default function ProfileLoading() {
  return (
    <main className="min-h-screen bg-[#11110d] text-[#edeae0]">
      <nav className="border-b border-[#2b2a24]">
        <div className="mx-auto flex h-16 max-w-[960px] items-center px-5 sm:px-8">
          <Logo />
        </div>
      </nav>
      <div className="mx-auto max-w-[840px] animate-pulse px-5 py-12 sm:px-8 sm:py-16">
        <div className="h-44 border-b border-[#2b2a24] bg-[#141410]" />
        <div className="mt-10 grid grid-cols-2 border-l border-t border-[#2b2a24] sm:grid-cols-3">
          {["one", "two", "three", "four", "five", "six"].map((item) => (
            <div key={item} className="h-28 border-b border-r border-[#2b2a24] bg-[#141410]" />
          ))}
        </div>
      </div>
    </main>
  );
}
