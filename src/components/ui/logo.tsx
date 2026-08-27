import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  compact?: boolean;
  wordmarkOnly?: boolean;
};

export function Logo({ compact = false, wordmarkOnly = false }: LogoProps) {
  return (
    <Link
      href="/"
      className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#11110d]"
      aria-label="Stack Stats home"
    >
      {!wordmarkOnly && (
        <Image
          src="/brand/stack-stats-mark.png"
          alt=""
          width={3668}
          height={2740}
          className={`${compact ? "block" : "block sm:hidden"} h-auto w-8`}
        />
      )}
      {!compact && (
        <Image
          src="/brand/stack-stats-wordmark.png"
          alt="Stack Stats"
          width={32234}
          height={3799}
          className={`${wordmarkOnly ? "block" : "hidden sm:block"} h-auto w-[170px]`}
        />
      )}
    </Link>
  );
}
