"use client";

import { ChartColumn, Sparkles, Code2, GitCompareArrows, Link2, Plus, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { sectionIconButton } from "@/components/profile/sortable-profile-section";
import { getModuleKey, getModuleLabel, moduleDefinitions, type ModuleType, type ProfileModule } from "@/lib/profile-layout";

// Presentation metadata stays separate from the serializable saved layout.
const sectionIcons: Record<ModuleType, LucideIcon> = {
  visualization: Sparkles,
  stats: ChartColumn,
  code_changes: GitCompareArrows,
  languages: Code2,
  links: Link2,
};

export function ProfileSectionPicker({ modules, disabled = false, onChoose, onAddVisualization, onClose }: {
  modules: ProfileModule[];
  disabled?: boolean;
  onChoose: (key: string) => void;
  onAddVisualization?: () => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const atLimit = modules.filter((section) => section.type === "visualization").length >= 6;
  const available = modules.filter((module) => !module.visible);
  useEffect(() => { heading.current?.focus(); }, []);

  return (
    <section id="available-profile-sections" aria-labelledby="section-picker-title" className="mt-5 rounded-[4px] border border-[#3b3931] bg-[#171712] p-4 sm:p-5" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="flex items-center justify-between gap-3">
        <h3 id="section-picker-title" ref={heading} tabIndex={-1} className="rounded-sm font-mono text-sm text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]">Add a section</h3>
        <button type="button" className={sectionIconButton} aria-label="Close section picker" onClick={onClose}><X className="size-4" aria-hidden="true" /></button>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#969287]">Choose what you want to showcase. Your saved choices come back with each section.</p>
      {available.length === 0 && !onAddVisualization ? <p className="mt-4 text-sm text-[#c8c4b9]">All available sections are already on your profile.</p> : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {onAddVisualization && <button type="button" disabled={disabled || atLimit} aria-label="Add visualization" className="flex items-center gap-3 rounded-[4px] border border-[#55a7ff]/50 bg-[#55a7ff]/5 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:opacity-40" onClick={onAddVisualization}>
            <Sparkles className="size-6 shrink-0 text-[#55a7ff]" aria-hidden="true" /><span><span className="block font-mono text-xs text-[#edeae0]">Visualization</span><span className="mt-1 block text-xs leading-5 text-[#969287]">{atLimit ? "Six visualizations added. Restore or edit an existing one." : "Choose your data, find your style, make it yours."}</span></span>
          </button>}
          {available.map((module) => {
            const definition = moduleDefinitions[module.type];
            const Icon = sectionIcons[module.type];
            return (
              <button key={getModuleKey(module)} type="button" disabled={disabled} aria-label={`Add ${getModuleLabel(module)}`} className="group flex items-center gap-3 rounded-[4px] border border-[#3b3931] p-4 text-left transition hover:border-[#55a7ff] hover:bg-[#1e211e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onChoose(getModuleKey(module))}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[4px] bg-[#55a7ff]/10 text-[#55a7ff]"><Icon className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-mono text-xs text-[#edeae0]">{getModuleLabel(module)}</span><span className="mt-1 block text-xs leading-5 text-[#969287]">{definition.description}</span></span>
                <Plus className="size-4 shrink-0 text-[#aaa69a] group-hover:text-[#55a7ff]" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
