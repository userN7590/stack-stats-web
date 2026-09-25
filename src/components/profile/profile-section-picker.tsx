"use client";

import { ChartColumn, Code2, GitCompareArrows, Link2, Plus, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { sectionIconButton } from "@/components/profile/sortable-profile-section";
import { moduleDefinitions, type ModuleType, type ProfileModule } from "@/lib/profile-layout";

// Presentation metadata stays separate from the serializable saved layout.
const sectionIcons: Record<ModuleType, LucideIcon> = {
  stats: ChartColumn,
  code_changes: GitCompareArrows,
  languages: Code2,
  links: Link2,
};

export function ProfileSectionPicker({ modules, disabled = false, onChoose, onClose }: {
  modules: ProfileModule[];
  disabled?: boolean;
  onChoose: (type: ModuleType) => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const available = modules.filter((module) => !module.visible);
  useEffect(() => { heading.current?.focus(); }, []);

  return (
    <section id="available-profile-sections" aria-labelledby="section-picker-title" className="mt-5 rounded-[4px] border border-[#3b3931] bg-[#171712] p-4 sm:p-5" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="flex items-center justify-between gap-3">
        <h3 id="section-picker-title" ref={heading} tabIndex={-1} className="rounded-sm font-mono text-sm text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]">Add a section</h3>
        <button type="button" className={sectionIconButton} aria-label="Close section picker" onClick={onClose}><X className="size-4" aria-hidden="true" /></button>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#969287]">Choose what you want to showcase. Your saved choices come back with each section.</p>
      {available.length === 0 ? <p className="mt-4 text-sm text-[#c8c4b9]">All available sections are already on your profile.</p> : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {available.map((module) => {
            const definition = moduleDefinitions[module.type];
            const Icon = sectionIcons[module.type];
            return (
              <button key={module.type} type="button" disabled={disabled} aria-label={`Add ${definition.label}`} className="group flex items-center gap-3 rounded-[4px] border border-[#3b3931] p-4 text-left transition hover:border-[#55a7ff] hover:bg-[#1e211e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onChoose(module.type)}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[4px] bg-[#55a7ff]/10 text-[#55a7ff]"><Icon className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-mono text-xs text-[#edeae0]">{definition.label}</span><span className="mt-1 block text-xs leading-5 text-[#969287]">{definition.description}</span></span>
                <Plus className="size-4 shrink-0 text-[#aaa69a] group-hover:text-[#55a7ff]" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
