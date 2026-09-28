import type { CSSProperties, ReactNode } from "react";

/**
 * Hand-drawn/technical annotation vocabulary. Every mark is decorative:
 * aria-hidden, pointer-events none, absolutely positioned inside an
 * `Annotated` anchor so it never changes layout. Paths are authored by hand
 * (deterministic, no randomness) and drawn in with CSS only; reduced motion
 * shows them complete.
 */

export type SketchTone = "pen" | "pencil";
/** `load`: draws once after page load. `view`: draws as it scrolls into view where supported. */
export type SketchDraw = "load" | "view" | "none";
type MarkProps = { className?: string; tone?: SketchTone; draw?: SketchDraw; delay?: number; style?: CSSProperties };

function Mark({ viewBox, stretch = false, className = "", tone = "pen", draw = "load", delay = 0, style, children }: MarkProps & { viewBox: string; stretch?: boolean; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={viewBox}
      preserveAspectRatio={stretch ? "none" : undefined}
      data-sketch=""
      className={`sketch sketch-${tone} sketch-draw-${draw} ${className}`}
      style={{ ...style, ["--sketch-delay" as string]: `${delay}ms` }}
    >
      {children}
    </svg>
  );
}

/** Wraps a word or phrase so marks can overlap, circle or point at it. */
export function Annotated({ children, marks, className = "" }: { children: ReactNode; marks: ReactNode; className?: string }) {
  return <span className={`sketch-anchor ${className}`}>{children}{marks}</span>;
}

/** One rough curly brace; use a left and a right pair to bracket a phrase like a code block. */
export function SketchBrace({ side, ...props }: MarkProps & { side: "left" | "right" }) {
  return (
    <Mark viewBox="0 0 24 100" stretch {...props}>
      {side === "left"
        ? <path pathLength={1} d="M20 3 C10.5 3.5 12.5 14 12.5 26 C12.5 37.5 10 45.5 3.5 50.5 C10.5 55 13 63 12.5 75 C12 87 10.5 96 19.5 97" />
        : <path pathLength={1} d="M4 4 C13.5 4 11.5 14.5 11.5 26.5 C11.5 38 14.5 45 20.5 49.5 C13.5 54.5 11 62.5 11.5 74 C12 86.5 13.5 95.5 4.5 96.5" />}
    </Mark>
  );
}

/** An overshooting loop with three nodes on it: several data points, one object. */
export function SketchNodeLoop(props: MarkProps) {
  return (
    <Mark viewBox="0 0 240 100" {...props}>
      <path pathLength={1} d="M36 74 C10 64 6 36 44 20 C86 4 170 4 206 20 C236 34 226 66 186 78 C140 92 70 92 30 72 C16 64 20 52 38 44" />
      <circle cx="44" cy="20" r="3.4" className="sketch-node" />
      <circle cx="206" cy="20" r="3.4" className="sketch-node" />
      <circle cx="186" cy="78" r="3.4" className="sketch-node" />
    </Mark>
  );
}

/** Two-pass hand underline. */
export function SketchUnderline(props: MarkProps) {
  return (
    <Mark viewBox="0 0 200 18" stretch {...props}>
      <path pathLength={1} d="M3 9 C44 4 88 12 128 7 C156 4 178 8 197 5" />
      <path pathLength={1} className="sketch-thin" d="M22 14 C70 10 118 14 172 10" />
    </Mark>
  );
}

/** Curved technical arrow. `right`: head at the right edge; `down`: head at the bottom right. */
export function SketchArrow({ direction = "right", ...props }: MarkProps & { direction?: "right" | "down" }) {
  return direction === "down" ? (
    <Mark viewBox="0 0 70 70" {...props}>
      <path pathLength={1} d="M4 9 C29 3 52 17 56 60" />
      <path pathLength={1} d="M46.5 49 L56.5 61.5 L64 47.5" />
    </Mark>
  ) : (
    <Mark viewBox="0 0 120 60" {...props}>
      <path pathLength={1} d="M5 52 C22 22 58 8 108 16" />
      <path pathLength={1} d="M95 6 L109 16 L94 25" />
    </Mark>
  );
}

/** Precise registration crosshair for structural intersections (not hand-drawn). */
export function Crosshair({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 17 17" className={`crosshair ${className}`}>
      <path d="M8.5 0 V17 M0 8.5 H17" />
      <circle cx="8.5" cy="8.5" r="3.5" />
    </svg>
  );
}
