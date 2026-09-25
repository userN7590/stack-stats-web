"use client";

import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Eye, GripVertical, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ProfileSectionPicker } from "@/components/profile/profile-section-picker";
import { sectionSurface, SortableProfileSection } from "@/components/profile/sortable-profile-section";
import { ProfileModuleContent, ProfileModules } from "@/components/profile/profile-modules";
import {
  getDefaultProfileLayout,
  isUnsupportedLayoutVersion,
  moduleDefinitions,
  moveModule,
  moveModuleTo,
  moveStat,
  normalizeProfileLayout,
  profileLayoutSchema,
  setModuleSize,
  setModuleVisibility,
  statIds,
  toggleStat,
  type ModuleType,
  type ProfileLayout,
} from "@/lib/profile-layout";
import { getProfileMetrics } from "@/lib/profile-metrics";
import { createClient } from "@/lib/supabase/client";
import type { PublicProfile } from "@/lib/types";

const buttonClass = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[3px] border border-[#3b3931] px-3 font-mono text-xs text-[#c8c4b9] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";
const iconClass = "size-3.5 shrink-0";

export function ProfileLayoutEditor({ profile }: { profile: PublicProfile }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => normalizeProfileLayout(profile.profile_layout));
  const [draft, setDraft] = useState(saved);
  const [activeType, setActiveType] = useState<ModuleType | null>(null);
  const [preview, setPreview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const statPicker = useRef<HTMLElement>(null);
  const sections = useRef<Partial<Record<ModuleType, HTMLElement | null>>>({});
  const unsupported = isUnsupportedLayoutVersion(profile.profile_layout);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const visible = draft.modules.filter((module) => module.visible);
  const activeModule = visible.find((module) => module.type === activeType);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const metrics = getProfileMetrics(profile);
  const profileHref = `/u/${profile.username}`;

  useEffect(() => {
    if (!dirty) return;
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Also covers the existing profile header/navbar links outside this editor.
    const warnOnNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Leave without saving your profile layout?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnOnUnload);
    document.addEventListener("click", warnOnNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnOnUnload);
      document.removeEventListener("click", warnOnNavigation, true);
    };
  }, [dirty]);

  function update(layout: ProfileLayout, message: string) {
    setDraft(layout);
    setError("");
    setAnnouncement(message);
  }

  function reorder(type: ModuleType, direction: -1 | 1) {
    const next = moveModule(draft, type, direction);
    const order = next.modules.filter((module) => module.visible);
    update(next, `${moduleDefinitions[type].label} moved to position ${order.findIndex((module) => module.type === type) + 1} of ${order.length}.`);
  }

  function finishDrag({ active, over }: DragEndEvent) {
    setActiveType(null);
    if (!over) return;
    const source = visible.find((module) => module.type === active.id);
    const target = visible.find((module) => module.type === over.id);
    if (!source || !target || source.type === target.type) return;
    const next = moveModuleTo(draft, source.type, target.type);
    update(next, `${moduleDefinitions[source.type].label} moved to position ${visible.findIndex((module) => module.type === target.type) + 1} of ${visible.length}.`);
  }

  function closePicker() {
    setAdding(false);
    addButton.current?.focus();
  }

  function hide(type: ModuleType) {
    if (visible.length <= 1) return;
    update(setModuleVisibility(draft, type, false), `${moduleDefinitions[type].label} hidden. Restore it with Add section.`);
    addButton.current?.focus();
  }

  function restore(type: ModuleType) {
    update(setModuleVisibility(draft, type, true), `${moduleDefinitions[type].label} added.`);
    setAdding(false);
    requestAnimationFrame(() => sections.current[type]?.focus());
  }

  async function save() {
    if (saving || unsupported) return;
    const result = profileLayoutSchema.safeParse(draft);
    if (!result.success) {
      setError("This layout could not be saved. Reset the layout and try again.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await createClient().rpc("update_profile_layout", { p_layout: result.data });
      if (saveError) {
        setError(saveError.code === "42501" || saveError.code === "PGRST301"
          ? "Your session has expired. Sign in again to save your layout."
          : "Your layout could not be saved. Your changes are still here; please try again.");
        return;
      }
      setSaved(result.data);
      setAnnouncement("Profile layout saved.");
      router.replace(profileHref, { scroll: false });
      router.refresh();
    } catch {
      setError("Your layout could not be saved. Your changes are still here; please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-6" aria-label="Customize profile">
      <div className="sm:sticky top-0 z-20 -mx-2 rounded-[4px] border border-[#3b3931] bg-[#171712]/95 p-4 backdrop-blur sm:-mx-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm text-[#edeae0]">Make this profile yours</h2>
            <p className="mt-1 text-xs text-[#969287]">{dirty ? "Unsaved changes" : "Drag the grips to arrange your profile. Save when it feels right."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={saving} onClick={() => router.replace(profileHref, { scroll: false })}>Cancel</button>
            <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-[3px] border border-[#55a7ff] bg-[#55a7ff] px-4 font-mono text-xs font-semibold text-[#11110d] transition hover:bg-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171712] disabled:cursor-not-allowed disabled:opacity-40" disabled={!dirty || saving || unsupported} onClick={save}>
              {saving ? "Saving…" : "Save layout"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button ref={addButton} type="button" className={buttonClass} disabled={saving || unsupported || preview} aria-expanded={adding} aria-controls="available-profile-sections" onClick={() => setAdding(!adding)}><Plus className={iconClass} />Add section</button>
          <button type="button" className={buttonClass} disabled={saving} aria-pressed={preview} onClick={() => { setPreview(!preview); setAdding(false); }}><Eye className={iconClass} />{preview ? "Edit sections" : "Preview"}</button>
          <button type="button" className={buttonClass} disabled={saving || unsupported} onClick={() => update(getDefaultProfileLayout(), "Default layout restored. Save to apply it.")}><RotateCcw className={iconClass} />Reset layout</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] text-[#aaa69a]">
          <Link className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]" href="/dashboard?section=identity">Profile details</Link>
          <Link className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]" href="/dashboard?section=appearance">Appearance</Link>
          <Link className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]" href="/settings/sync">Sync settings</Link>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-[#e58b83]">{error}</p>}
      </div>

      <p className="mt-4 text-xs leading-5 text-[#858177]">Hiding a section changes how your profile looks. Manage what you publish in Sync settings.</p>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>

      {unsupported && <p role="alert" className="mt-5 border border-[#3b3931] p-4 text-sm text-[#d8aa54]">This layout was saved with a newer version of Stack Stats. Editing is unavailable here, so your saved layout stays intact.</p>}

      {adding && <ProfileSectionPicker modules={draft.modules} disabled={saving} onChoose={restore} onClose={closePicker} />}

      {preview || unsupported ? <ProfileModules profile={profile} layout={draft} /> : (
        <DndContext
          id="profile-sections"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => { setAdding(false); setActiveType(visible.find((module) => module.type === active.id)?.type ?? null); }}
          onDragCancel={() => setActiveType(null)}
          onDragEnd={finishDrag}
          accessibility={{
            screenReaderInstructions: { draggable: "To reorder this section, press Space, use the arrow keys to move, then press Space again to drop. Press Escape to cancel. You can also use the Shift section up and down buttons." },
            announcements: {
              onDragStart: ({ active }) => `Picked up ${moduleDefinitions[active.id as ModuleType].label}.`,
              onDragOver: ({ active, over }) => over ? `${moduleDefinitions[active.id as ModuleType].label}, position ${visible.findIndex((module) => module.type === over.id) + 1} of ${visible.length}.` : "Outside the sections. Release to cancel.",
              onDragEnd: ({ active, over }) => over ? `${moduleDefinitions[active.id as ModuleType].label} dropped at position ${visible.findIndex((module) => module.type === over.id) + 1} of ${visible.length}.` : "Reordering cancelled.",
              onDragCancel: () => "Reordering cancelled. Your layout is unchanged.",
            },
          }}
        >
          <SortableContext items={visible.map((module) => module.type)} strategy={rectSortingStrategy}>
            <div className="mt-6 grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
              {visible.map((module, index) => (
                <SortableProfileSection
                  key={module.type}
                  module={module}
                  index={index}
                  count={visible.length}
                  disabled={saving}
                  sectionRef={(element) => { sections.current[module.type] = element; }}
                  onShift={(direction) => reorder(module.type, direction)}
                  onHide={() => hide(module.type)}
                  onSize={(size) => update(setModuleSize(draft, module.type, size), `${moduleDefinitions[module.type].label} set to ${size} width.`)}
                >
                  {module.type === "stats" && (
                    <fieldset disabled={saving} className="mb-4 min-w-0">
                      <legend className="sr-only">Headline stat selection</legend>
                      <details>
                        <summary ref={statPicker} className="cursor-pointer rounded-[3px] py-2 font-mono text-xs text-[#c8c4b9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]">Choose stats · {module.stats.length} of {statIds.length}</summary>
                        <p className="mt-2 text-xs text-[#969287]">Choose one to six stats. Move them into the order you want.</p>
                        <ol className="mt-3 divide-y divide-[#2b2a24]">
                          {module.stats.map((id, statIndex) => (
                            <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <span className="font-mono text-xs text-[#c8c4b9]">{metrics[id].label}</span>
                              <div className="flex gap-1">
                                <button type="button" className={buttonClass} aria-label={`Move ${metrics[id].label} earlier`} aria-disabled={statIndex === 0} onClick={() => { if (statIndex > 0) update(moveStat(draft, id, -1), `${metrics[id].label} moved earlier.`); }}><ArrowUp className={iconClass} /></button>
                                <button type="button" className={buttonClass} aria-label={`Move ${metrics[id].label} later`} aria-disabled={statIndex === module.stats.length - 1} onClick={() => { if (statIndex < module.stats.length - 1) update(moveStat(draft, id, 1), `${metrics[id].label} moved later.`); }}><ArrowDown className={iconClass} /></button>
                                <button type="button" className={buttonClass} aria-label={`Remove ${metrics[id].label}`} disabled={module.stats.length === 1} onClick={() => { update(toggleStat(draft, id), `${metrics[id].label} removed from headline stats.`); statPicker.current?.focus(); }}>Remove</button>
                              </div>
                            </li>
                          ))}
                        </ol>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {statIds.filter((id) => !module.stats.includes(id)).map((id) => <button key={id} type="button" className={buttonClass} onClick={() => update(toggleStat(draft, id), `${metrics[id].label} added to headline stats.`)}><Plus className={iconClass} />Add {metrics[id].label}</button>)}
                        </div>
                      </details>
                    </fieldset>
                  )}
                  <ProfileModuleContent profile={profile} module={module} />
                </SortableProfileSection>
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeModule && (
              <div aria-hidden="true" inert className={`${sectionSurface} pointer-events-none border-[#55a7ff] shadow-[0_16px_60px_#0009]`}>
                <div className="mb-4 flex min-h-11 items-center gap-3 border-b border-[#3b3931] pb-2 font-mono text-xs text-[#55a7ff]"><GripVertical className="size-5" />{moduleDefinitions[activeModule.type].label}</div>
                <ProfileModuleContent profile={profile} module={activeModule} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
