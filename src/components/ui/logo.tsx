import Link from "next/link";

type LogoProps = {
  compact?: boolean;
};

export function Logo({ compact = false }: LogoProps) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#070a09]"
      aria-label="Stack Stats home"
    >
      <span className="relative grid size-8 place-items-center overflow-hidden rounded-lg border border-emerald-300/30 bg-emerald-400/10 font-mono text-sm font-bold text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
        <span aria-hidden="true">S/</span>
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-white">
          Stack <span className="text-zinc-500">Stats</span>
        </span>
      )}
    </Link>
  );
}
