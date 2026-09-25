"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, ChevronUp, EyeOff, GripVertical, MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { getModuleKey, getModuleLabel, moduleDefinitions, type ModuleSize, type ProfileModule } from "@/lib/profile-layout";

export const sectionIconButton = "inline-flex size-11 shrink-0 items-center justify-center rounded-[3px] text-[#aaa69a] transition hover:bg-[#24231d] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:cursor-not-allowed disabled:opacity-35 aria-disabled:cursor-not-allowed aria-disabled:opacity-35";
export const sectionSurface = "min-w-0 rounded-[4px] border bg-[#11110d] p-3 sm:p-5";

export function SortableProfileSection({ module, index, count, disabled, sectionRef, onShift, onHide, onSize, children }: {
  module: ProfileModule;
  index: number;
  count: number;
  disabled: boolean;
  sectionRef: (element: HTMLElement | null) => void;
  onShift: (direction: -1 | 1) => void;
  onHide: () => void;
  onSize: (size: ModuleSize) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: getModuleKey(module), disabled });
  const [options, setOptions] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const label = getModuleLabel(module);

  useEffect(() => {
    if (!options) return;
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOptions(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [options]);

  function closeOptions() {
    setOptions(false);
    trigger.current?.focus();
  }

  return (
    <section
      ref={(element) => { setNodeRef(element); sectionRef(element); }}
      tabIndex={-1}
      aria-label={`${label} section`}
      data-profile-section={getModuleKey(module)}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: options ? 10 : undefined }}
      className={`${sectionSurface} relative border-[#3b3931] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] motion-reduce:!transition-none ${isDragging ? "border-dashed border-[#55a7ff] opacity-30" : ""} ${module.size === "full" ? "sm:col-span-2" : ""}`}
    >
      <div className="mb-4 flex min-w-0 items-center gap-1 border-b border-[#2b2a24] pb-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`Drag ${label} section to reorder`}
          title="Drag to reorder, or use the arrow buttons"
          className={`${sectionIconButton} -ml-2 touch-none cursor-grab active:cursor-grabbing`}
        ><GripVertical className="size-5" aria-hidden="true" /></button>
        <h3 className="min-w-0 flex-1 font-mono text-xs text-[#c8c4b9]">{label}</h3>
        <div className="flex shrink-0" role="group" aria-label={`${label} section controls`}>
          <button type="button" className={sectionIconButton} disabled={disabled} aria-label={`Shift ${label} section up`} title="Shift section up" aria-disabled={index === 0} onClick={() => { if (index > 0) onShift(-1); }}><ChevronUp className="size-4" aria-hidden="true" /></button>
          <button type="button" className={sectionIconButton} disabled={disabled} aria-label={`Shift ${label} section down`} title="Shift section down" aria-disabled={index === count - 1} onClick={() => { if (index < count - 1) onShift(1); }}><ChevronDown className="size-4" aria-hidden="true" /></button>
          <div
            className="relative"
            onKeyDown={(event) => { if (event.key === "Escape" && options) { event.stopPropagation(); closeOptions(); } }}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOptions(false); }}
          >
            <button ref={trigger} type="button" className={sectionIconButton} disabled={disabled} aria-label={`${label} section options`} title="Section options" aria-expanded={options} aria-controls={optionsId} onClick={() => setOptions(!options)}><MoreHorizontal className="size-5" aria-hidden="true" /></button>
            {options && (
              <div ref={menu} id={optionsId} role="group" aria-label={`${label} section options`} className="absolute right-0 top-full z-10 w-56 rounded-[4px] border border-[#444239] bg-[#1b1b15] p-2 shadow-xl">
                {moduleDefinitions[module.type].sizes.length > 1 && (
                  <div role="group" aria-label={`${label} width`} className="mb-2 border-b border-[#3b3931] pb-2">
                    <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[#858177]">Section width</p>
                    {moduleDefinitions[module.type].sizes.map((size) => (
                      <button key={size} type="button" className={`${sectionIconButton} h-auto min-h-11 w-full justify-start gap-2 px-3 text-xs`} aria-label={`Set ${size} width`} aria-pressed={module.size === size} disabled={disabled} onClick={() => { onSize(size); closeOptions(); }}>
                        <Check className={`size-4 ${module.size === size ? "text-[#55a7ff]" : "invisible"}`} aria-hidden="true" />{size === "full" ? "Full width" : "Half width"}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className={`${sectionIconButton} h-auto min-h-11 w-full justify-start gap-2 px-3 text-xs`} aria-label={`Hide ${label} section`} disabled={disabled || count === 1} onClick={onHide}><EyeOff className="size-4" aria-hidden="true" />Hide section</button>
                {count === 1 && <p className="px-3 pb-2 text-xs text-[#969287]">Keep at least one section.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
