"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ProfileModuleContent, ProfileModules } from "@/components/profile/profile-modules";
import {
  getDefaultProfileLayout,
  isUnsupportedLayoutVersion,
  moduleDefinitions,
  moveModule,
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
  const hidden = draft.modules.filter((module) => !module.visible);
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
      <div className="sticky top-0 z-20 -mx-2 rounded-[4px] border border-[#3b3931] bg-[#171712]/95 p-4 backdrop-blur sm:-mx-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm text-[#edeae0]">Make this profile yours</h2>
            <p className="mt-1 text-xs text-[#969287]">{dirty ? "Unsaved changes" : "Arrange the sections below. Changes go live when you save."}</p>
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

      {adding && (
        <div id="available-profile-sections" className="mt-5 rounded-[4px] border border-[#3b3931] bg-[#171712] p-4">
          <h3 className="font-mono text-sm text-[#edeae0]">Add a section</h3>
          {hidden.length === 0 ? <p className="mt-2 text-sm text-[#969287]">All available sections are already on your profile.</p> : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {hidden.map((module) => <button key={module.type} type="button" disabled={saving} className={`${buttonClass} flex-col items-start p-4 text-left`} onClick={() => restore(module.type)}><span>Add {moduleDefinitions[module.type].label}</span><span className="font-sans text-xs leading-5 text-[#969287]">{moduleDefinitions[module.type].description}</span></button>)}
            </div>
          )}
        </div>
      )}

      {preview || unsupported ? <ProfileModules profile={profile} layout={draft} /> : (
        <div className="mt-6 grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
          {visible.map((module, index) => (
            <section
              key={module.type}
              ref={(element) => { sections.current[module.type] = element; }}
              tabIndex={-1}
              aria-label={`${moduleDefinitions[module.type].label} section`}
              data-profile-section={module.type}
              className={`min-w-0 rounded-[4px] border border-[#3b3931] bg-[#11110d]/80 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] sm:p-5 ${module.size === "full" ? "sm:col-span-2" : ""}`}
            >
              <fieldset disabled={saving} className="mb-6 min-w-0 border-b border-[#2b2a24] pb-4">
                <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#55a7ff]">{index + 1} / {moduleDefinitions[module.type].label}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={buttonClass} aria-label={`Move ${moduleDefinitions[module.type].label} up`} aria-disabled={index === 0} onClick={() => { if (index > 0) reorder(module.type, -1); }}><ArrowUp className={iconClass} /><span>Up</span></button>
                  <button type="button" className={buttonClass} aria-label={`Move ${moduleDefinitions[module.type].label} down`} aria-disabled={index === visible.length - 1} onClick={() => { if (index < visible.length - 1) reorder(module.type, 1); }}><ArrowDown className={iconClass} /><span>Down</span></button>
                  <button type="button" className={buttonClass} aria-label={`Hide ${moduleDefinitions[module.type].label}`} disabled={visible.length === 1} title={visible.length === 1 ? "Keep at least one section" : undefined} onClick={() => hide(module.type)}><EyeOff className={iconClass} />Hide</button>
                </div>
                {moduleDefinitions[module.type].sizes.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`${moduleDefinitions[module.type].label} width`}>
                    {moduleDefinitions[module.type].sizes.map((size) => <button key={size} type="button" className={`${buttonClass} aria-pressed:border-[#55a7ff] aria-pressed:text-[#55a7ff]`} aria-pressed={module.size === size} onClick={() => update(setModuleSize(draft, module.type, size), `${moduleDefinitions[module.type].label} set to ${size === "full" ? "full" : "half"} width.`)}>{size === "full" ? "Full width" : "Half width"}</button>)}
                  </div>
                )}
                {module.type === "stats" && (
                  <details className="mt-4">
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
                )}
              </fieldset>
              <ProfileModuleContent profile={profile} module={module} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
