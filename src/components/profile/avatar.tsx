"use client";

import { useState } from "react";

import { getInitials } from "@/lib/format";

type AvatarProps = {
  name: string;
  src: string | null;
};

export function Avatar({ name, src }: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-300/20 to-cyan-400/5 font-mono text-2xl font-semibold text-emerald-200 shadow-[0_20px_60px_rgba(0,0,0,0.4)] sm:size-28">
      {src && !hasError ? (
        // User-provided avatar hosts cannot be known at build time.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name}'s avatar`}
          className="size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </div>
  );
}
