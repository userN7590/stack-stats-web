"use client";

import { ChartColumn, Sparkles, Code2, GitCompareArrows, Link2, Plus, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ContentType } from "@/lib/profile-content";
import { sectionIconButton } from "@/components/profile/sortable-profile-section";
import { getModuleKey, getModuleLabel, moduleDefinitions, type ModuleType, type ProfileModule } from "@/lib/profile-layout";

// Presentation metadata stays separate from the serializable saved layout.
const sectionIcons: Record<ModuleType, LucideIcon> = {
  single_stat: ChartColumn, stat_grid: ChartColumn, dataset: ChartColumn, document: Link2, link_collection: Link2,
  visualization: Sparkles,
  stats: ChartColumn,
  code_changes: GitCompareArrows,
  languages: Code2,
  links: Link2,
};

export function ProfileSectionPicker({ modules, disabled = false, onChoose, onAddVisualization, onAddContent, onClose }: {
  modules: ProfileModule[];
  disabled?: boolean;
  onChoose: (key: string) => void;
  onAddVisualization?: () => void;
  onAddContent?: (type: ContentType) => void;
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
      {onAddContent && <div className="mt-6 space-y-6">
        {([
          ["Data", ["single_stat", "stat_grid", "dataset"]],
          ["Media", ["document"]],
          ["Other", ["link_collection"]],
        ] as [string, ContentType[]][]).map(([category, types]) => <div key={category}>
          <h4 className="mb-2 font-mono text-xs uppercase tracking-wider text-[#aaa69a]">{category}</h4>
          <div className="divide-y divide-[#2b2a24]">{types.map(type => <button key={type} type="button" disabled={disabled || modules.length >= 20} className="block min-h-16 w-full py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:opacity-40" onClick={() => onAddContent(type)} aria-label={`Add ${moduleDefinitions[type].label}`}><span className="block text-sm text-[#edeae0]">{moduleDefinitions[type].label}</span><span className="mt-1 block text-xs leading-5 text-[#aaa69a]">{moduleDefinitions[type].description}</span></button>)}</div>
          {category === "Media" && <div className="border-t border-[#2b2a24] py-3"><button type="button" disabled aria-describedby="image-unavailable" className="min-h-11 text-sm text-[#aaa69a]">Image · Not available yet</button><p id="image-unavailable" className="text-xs leading-5 text-[#aaa69a]">Image uploads are coming later. For now, add a link to your project or visual.</p></div>}
        </div>)}
        {modules.length >= 20 && <p className="text-xs text-[#aaa69a]">Twenty sections added. Restore an existing section or remove one first.</p>}
      </div>}
      {onAddContent && available.length > 0 && <h4 className="mt-6 font-mono text-xs uppercase tracking-wider text-[#aaa69a]">Restore hidden sections</h4>}
      {available.length === 0 && !onAddVisualization && !onAddContent ? <p className="mt-4 text-sm text-[#c8c4b9]">All available sections are already on your profile.</p> : (
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
