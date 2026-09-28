"use client";

import { useState } from "react";

import { getInitials } from "@/lib/format";

type AvatarProps = {
  name: string;
  src: string | null;
  /** `card`: compact avatar for homepage profile cards. */
  size?: "profile" | "card";
};

const sizes = {
  profile: "size-24 rounded-[4px] text-2xl sm:size-28",
  card: "size-10 rounded-[6px] text-xs",
};

export function Avatar({ name, src, size = "profile" }: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden border border-[#34332c] bg-[#191914] font-mono font-medium text-[#55a7ff] ${sizes[size]}`}>
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
