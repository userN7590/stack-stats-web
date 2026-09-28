import type { ReactNode } from "react";

import { Crosshair } from "@/components/annotations/sketch";

/**
 * Site coordinate system, shared with the Phase 9C profile frame: a 1,080px
 * frame with quiet outer rails, six column guides, and full-bleed horizontal
 * rules between sections. Rules define geometry; content is not boxed.
 */

/** Full-bleed horizontal rule below; framed, railed content inside. */
export function RuleSection({ children, className = "", frameClassName = "", guides = false, marks = false, id, label }: {
  children: ReactNode;
  className?: string;
  frameClassName?: string;
  guides?: boolean;
  marks?: boolean;
  id?: string;
  label?: string;
}) {
  return (
    <section id={id} aria-label={label} className={`site-section ${className}`}>
      <div className={`site-frame ${frameClassName}`}>
        {guides && <ColumnGuides />}
        {marks && <FrameMarks />}
        {children}
      </div>
    </section>
  );
}

/** Six faint column guides that continue through whitespace (≥768px). */
export function ColumnGuides() {
  return (
    <div aria-hidden="true" className="site-guides">
      {[0, 1, 2, 3, 4, 5].map((column) => <span key={column} />)}
    </div>
  );
}

/** Registration crosshairs where the rails meet the section's bottom rule. */
export function FrameMarks() {
  return (
    <>
      <Crosshair className="frame-mark frame-mark-left" />
      <Crosshair className="frame-mark frame-mark-right" />
    </>
  );
}

/** Mono section index, e.g. “01 — Capture”. */
export function SectionIndex({ index, children }: { index: string; children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#858177]">
      <span className="text-[#55a7ff]">{index}</span>
      <span aria-hidden="true" className="mx-2 text-[#4a483f]">—</span>
      {children}
    </p>
  );
}
