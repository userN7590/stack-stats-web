"use client";

import { AlertCircle, Check, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ProfileBackground } from "@/components/profile/profile-background";
import {
  backgroundStyles,
  displayFonts,
  getDisplayFontClass,
  normalizeBackgroundStyle,
  normalizeDisplayFont,
  type BackgroundStyle,
  type DisplayFont,
} from "@/lib/appearance";
import { formatCodingTime, formatNumber, getInitials } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { appearanceSchema } from "@/lib/validation";

type AppearanceFormProps = {
  profile: Profile;
};

export function AppearanceForm({ profile }: AppearanceFormProps) {
  const router = useRouter();
  const [displayFont, setDisplayFont] = useState<DisplayFont>(
    normalizeDisplayFont(profile.display_font),
  );
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>(
    normalizeBackgroundStyle(profile.background_style),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const previewName = profile.display_name || profile.username;
  const selectedFont = displayFonts.find(
    (option) => option.value === displayFont,
  );
  const selectedBackground = backgroundStyles.find(
    (option) => option.value === backgroundStyle,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const result = appearanceSchema.safeParse({
      displayFont,
      backgroundStyle,
    });

    if (!result.success) {
      setErrorMessage("Choose one of the available appearance presets.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("update_profile_appearance", {
        p_display_font: result.data.displayFont,
        p_background_style: result.data.backgroundStyle,
      });

      if (error) {
        if (error.code === "PGRST202" || error.code === "42883") {
          throw new Error(
            "Appearance settings are not available until the latest database migration is applied.",
          );
        }

        throw new Error("Your appearance could not be saved. Please try again.");
      }

      router.replace(`/u/${profile.username}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your appearance could not be saved. Please try again.",
      );
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-12">
      <section aria-labelledby="appearance-preview-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
              Live preview
            </p>
            <h2
              id="appearance-preview-heading"
              className="mt-1.5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]"
            >
              Font and atmosphere together
            </h2>
          </div>
          <p
            className="font-mono text-[10px] text-[#969287]"
            aria-live="polite"
          >
            {selectedFont?.label} · {selectedBackground?.label}
          </p>
        </div>

        <div className="relative isolate mt-6 min-h-64 overflow-hidden border border-[#34332c] bg-[#11110d] px-5 py-6 sm:px-7 sm:py-8">
          <ProfileBackground style={backgroundStyle} mode="preview" />
          <div className="relative z-10 flex items-start gap-5">
            <div className="grid size-16 shrink-0 place-items-center border border-[#4a483f] bg-[#191914]/90 font-mono text-sm text-[#55a7ff]">
              {getInitials(previewName)}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`${getDisplayFontClass(displayFont)} truncate text-4xl leading-tight text-[#edeae0] sm:text-5xl`}
              >
                {previewName}
              </p>
              <p className="mt-1.5 font-mono text-xs text-[#55a7ff]">
                @{profile.username}
              </p>
            </div>
          </div>
          <div className="relative z-10 mt-8 grid grid-cols-2 border-l border-t border-[#edeae0]/10 sm:grid-cols-3">
            <PreviewStat label="Lines added" value={formatNumber(profile.lines_added)} />
            <PreviewStat label="Projects" value={formatNumber(profile.projects_count)} />
            <PreviewStat
              label="Coding time"
              value={formatCodingTime(profile.coding_minutes)}
            />
          </div>
        </div>
      </section>

      <fieldset className="border-t border-[#2b2a24] pt-8">
        <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
          05 / Display font
        </legend>
        <h2 className="mt-1.5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">
          Profile name
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#969287]">
          Choose the visual character of your display name. Your username stays
          in the standard Stack Stats monospace.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {displayFonts.map((option) => {
            const isSelected = displayFont === option.value;

            return (
              <label
                key={option.value}
                className={`cursor-pointer border px-4 py-5 transition focus-within:ring-2 focus-within:ring-[#55a7ff] ${
                  isSelected
                    ? "border-[#55a7ff] bg-[#18222a]"
                    : "border-[#34332c] bg-[#151510] hover:border-[#565249]"
                }`}
              >
                <input
                  type="radio"
                  name="displayFont"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setDisplayFont(option.value)}
                  disabled={isSaving}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[#969287]">
                  {option.label}
                  <span className={isSelected ? "text-[#78b8ff]" : "text-[#77746b]"}>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="size-3" /> Selected
                      </span>
                    ) : (
                      "Select"
                    )}
                  </span>
                </span>
                <span
                  className={`mt-5 block truncate text-3xl leading-tight text-[#edeae0] ${option.className}`}
                >
                  {previewName}
                </span>
                <span className="mt-3 block text-xs leading-5 text-[#77746b]">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="border-t border-[#2b2a24] pt-8">
        <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
          06 / Background
        </legend>
        <h2 className="mt-1.5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">
          Profile atmosphere
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#969287]">
          Add a quiet, non-interactive backdrop to your public profile.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {backgroundStyles.map((option) => {
            const isSelected = backgroundStyle === option.value;

            return (
              <label
                key={option.value}
                className={`cursor-pointer overflow-hidden border transition focus-within:ring-2 focus-within:ring-[#55a7ff] ${
                  isSelected
                    ? "border-[#55a7ff]"
                    : "border-[#34332c] hover:border-[#565249]"
                }`}
              >
                <input
                  type="radio"
                  name="backgroundStyle"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setBackgroundStyle(option.value)}
                  disabled={isSaving}
                  className="sr-only"
                />
                <span className="relative isolate block h-36 overflow-hidden bg-[#11110d]">
                  <ProfileBackground style={option.value} mode="preview" />
                  <span
                    className="absolute inset-0 z-10 flex flex-col justify-between p-4"
                    aria-hidden="true"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="block size-8 border border-[#edeae0]/20 bg-[#191914]/90" />
                      <span className="space-y-1.5">
                        <span className="block h-1.5 w-20 bg-[#edeae0]/55" />
                        <span className="block h-1 w-12 bg-[#55a7ff]/65" />
                      </span>
                    </span>
                    <span className="grid grid-cols-3 gap-2">
                      <span className="h-7 border border-[#edeae0]/10 bg-[#11110d]/35" />
                      <span className="h-7 border border-[#edeae0]/10 bg-[#11110d]/35" />
                      <span className="h-7 border border-[#edeae0]/10 bg-[#11110d]/35" />
                    </span>
                  </span>
                </span>
                <span className="block border-t border-[#2b2a24] bg-[#151510] px-4 py-3">
                  <span className="flex items-center justify-between gap-3 font-mono text-xs text-[#c8c4b9]">
                    {option.label}
                    <span
                      className={`inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.08em] ${
                        isSelected ? "text-[#78b8ff]" : "text-[#77746b]"
                      }`}
                    >
                      {isSelected && <Check className="size-3" />}
                      {isSelected ? "Selected" : "Select"}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-xs leading-5 text-[#77746b]">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="sticky bottom-0 z-20 border border-[#34332c] bg-[#11110d] p-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0" aria-live="polite">
          {errorMessage ? (
            <p className="flex items-start gap-2 text-sm text-[#e58b83]" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          ) : (
            <p className="px-1 text-xs text-[#77746b]">
              Presets apply only to your public profile.
            </p>
          )}
        </div>
        <div className="mt-3 flex shrink-0 gap-2 sm:mt-0 sm:pl-4">
          <Link
            href={`/u/${profile.username}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[3px] border border-[#3b3931] px-4 font-mono text-xs text-[#c8c4b9] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] sm:flex-none"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[3px] bg-[#55a7ff] px-5 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11110d] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            {isSaving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving ? "Saving…" : "Save appearance"}
          </button>
        </div>
      </div>
    </form>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 border-b border-r border-[#edeae0]/10 bg-[#11110d]/30 px-3 py-3">
      <span className="block truncate font-mono text-sm text-[#edeae0]">
        {value}
      </span>
      <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.1em] text-[#969287]">
        {label}
      </span>
    </span>
  );
}
