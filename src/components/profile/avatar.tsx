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
    <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-[4px] border border-[#34332c] bg-[#191914] font-mono text-2xl font-medium text-[#55a7ff] sm:size-28">
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
