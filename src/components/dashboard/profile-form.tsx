"use client";

import {
  AlertCircle,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Profile, ProfileLanguage } from "@/lib/types";
import { profileSchema } from "@/lib/validation";

type ProfileFormProps = {
  initialProfile: Profile | null;
  initialLanguages: ProfileLanguage[];
  section: ProfileFormSection;
};

export type ProfileFormSection = "identity" | "links" | "stats" | "languages";

type LanguageRow = {
  rowId: string;
  name: string;
  percentage: string;
};

type Feedback = {
  message: string;
} | null;

const stats = [
  { name: "linesAdded", label: "Lines added", column: "lines_added" },
  { name: "linesRemoved", label: "Lines removed", column: "lines_removed" },
  { name: "filesChanged", label: "Files changed", column: "files_changed" },
  { name: "editEvents", label: "Edit events", column: "edit_events" },
  { name: "projectsCount", label: "Projects worked on", column: "projects_count" },
  { name: "codingMinutes", label: "Coding time (minutes)", column: "coding_minutes" },
] as const;

const inputClass =
  "mt-2 h-11 w-full rounded-[3px] border border-[#34332c] bg-[#171712] px-3.5 text-sm text-[#edeae0] outline-none transition placeholder:text-[#68655d] hover:border-[#4a483f] focus:border-[#55a7ff] focus:ring-2 focus:ring-[#55a7ff]/20 disabled:cursor-not-allowed disabled:opacity-60";

function createRow(): LanguageRow {
  return {
    rowId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: "",
    percentage: "",
  };
}

export function ProfileForm({
  initialProfile,
  initialLanguages,
  section,
}: ProfileFormProps) {
  const router = useRouter();
  const [languages, setLanguages] = useState<LanguageRow[]>(
    initialLanguages.map((language) => ({
      rowId: language.id,
      name: language.name,
      percentage: String(language.percentage),
    })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function updateLanguage(
    rowId: string,
    field: "name" | "percentage",
    value: string,
  ) {
    setLanguages((current) =>
      current.map((language) =>
        language.rowId === rowId ? { ...language, [field]: value } : language,
      ),
    );
  }

  function removeLanguage(rowId: string) {
    setLanguages((current) =>
      current.filter((language) => language.rowId !== rowId),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const rawInput = {
      username:
        section === "identity"
          ? formData.get("username")
          : initialProfile?.username ?? "",
      displayName:
        section === "identity"
          ? formData.get("displayName")
          : initialProfile?.display_name ?? "",
      bio:
        section === "identity"
          ? formData.get("bio")
          : initialProfile?.bio ?? "",
      avatarUrl:
        section === "identity"
          ? formData.get("avatarUrl")
          : initialProfile?.avatar_url ?? "",
      githubUrl:
        section === "links"
          ? formData.get("githubUrl")
          : initialProfile?.github_url ?? "",
      websiteUrl:
        section === "links"
          ? formData.get("websiteUrl")
          : initialProfile?.website_url ?? "",
      linesAdded:
        section === "stats"
          ? formData.get("linesAdded")
          : initialProfile?.lines_added ?? 0,
      linesRemoved:
        section === "stats"
          ? formData.get("linesRemoved")
          : initialProfile?.lines_removed ?? 0,
      filesChanged:
        section === "stats"
          ? formData.get("filesChanged")
          : initialProfile?.files_changed ?? 0,
      editEvents:
        section === "stats"
          ? formData.get("editEvents")
          : initialProfile?.edit_events ?? 0,
      projectsCount:
        section === "stats"
          ? formData.get("projectsCount")
          : initialProfile?.projects_count ?? 0,
      codingMinutes:
        section === "stats"
          ? formData.get("codingMinutes")
          : initialProfile?.coding_minutes ?? 0,
      languages:
        section === "languages"
          ? languages
          : initialLanguages.map((language) => ({
              rowId: language.id,
              name: language.name,
              percentage: String(language.percentage),
            })),
    };
    const result = profileSchema.safeParse(rawInput);

    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path.join(".");
        nextErrors[field] ??= issue.message;
      });
      setFieldErrors(nextErrors);
      setFeedback({
        message: "Review the highlighted fields, then try saving again.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error: profileError } = await supabase.rpc("save_profile", {
        p_username: result.data.username,
        p_display_name: result.data.displayName,
        p_bio: result.data.bio,
        p_avatar_url: result.data.avatarUrl,
        p_github_url: result.data.githubUrl,
        p_website_url: result.data.websiteUrl,
        p_lines_added: result.data.linesAdded,
        p_lines_removed: result.data.linesRemoved,
        p_files_changed: result.data.filesChanged,
        p_edit_events: result.data.editEvents,
        p_projects_count: result.data.projectsCount,
        p_coding_minutes: result.data.codingMinutes,
        p_languages: result.data.languages.map((language) => ({
          name: language.name,
          percentage: language.percentage,
        })),
      });

      if (profileError) {
        if (profileError.code === "23505") {
          setFieldErrors({ username: "That username is already taken." });
          throw new Error("Choose a different username, then save again.");
        }
        throw profileError;
      }

      router.replace(`/u/${result.data.username}`);
      router.refresh();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Your profile could not be saved. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function errorFor(field: string) {
    return fieldErrors[field];
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-12">
      {section === "identity" && (
      <section className="border-t border-[#2b2a24] pt-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
            01 / Identity
          </p>
          <h2 className="mt-1.5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">
            Public profile
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#969287]">
            Choose what people see when they open your profile.
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="username" className="font-mono text-xs text-[#c8c4b9]">
              Username <span className="text-[#55a7ff]">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-[1.15rem] font-mono text-sm text-[#77746b]">
                @
              </span>
              <input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                defaultValue={initialProfile?.username ?? ""}
                disabled={isSaving}
                aria-invalid={Boolean(errorFor("username"))}
                aria-describedby={errorFor("username") ? "username-error" : "username-help"}
                placeholder="your-handle"
                className={`${inputClass} pl-8 font-mono`}
              />
            </div>
            {errorFor("username") ? (
              <p id="username-error" className="mt-1.5 text-xs text-[#e58b83]">
                {errorFor("username")}
              </p>
            ) : (
              <p id="username-help" className="mt-1.5 text-xs text-[#77746b]">
                3–30 lowercase characters; numbers, _ and - are allowed.
              </p>
            )}
          </div>

          <TextField
            id="displayName"
            label="Display name"
            placeholder="Ada Lovelace"
            defaultValue={initialProfile?.display_name ?? ""}
            maxLength={60}
            disabled={isSaving}
            error={errorFor("displayName")}
          />
        </div>

        <div className="mt-5">
          <label htmlFor="bio" className="font-mono text-xs text-[#c8c4b9]">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={280}
            defaultValue={initialProfile?.bio ?? ""}
            disabled={isSaving}
            aria-invalid={Boolean(errorFor("bio"))}
            aria-describedby={errorFor("bio") ? "bio-error" : "bio-help"}
            placeholder="What do you build, and what do you care about?"
            className="mt-2 w-full resize-y rounded-[3px] border border-[#34332c] bg-[#171712] px-3.5 py-3 text-sm leading-6 text-[#edeae0] outline-none transition placeholder:text-[#68655d] hover:border-[#4a483f] focus:border-[#55a7ff] focus:ring-2 focus:ring-[#55a7ff]/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {errorFor("bio") ? (
            <p id="bio-error" className="mt-1.5 text-xs text-[#e58b83]">
              {errorFor("bio")}
            </p>
          ) : (
            <p id="bio-help" className="mt-1.5 text-xs text-[#77746b]">
              Up to 280 characters.
            </p>
          )}
        </div>

        <div className="mt-5 sm:max-w-[calc(50%_-_0.625rem)]">
          <TextField
            id="avatarUrl"
            label="Avatar URL"
            type="url"
            inputMode="url"
            placeholder="https://example.com/avatar.jpg"
            defaultValue={initialProfile?.avatar_url ?? ""}
            maxLength={2048}
            disabled={isSaving}
            error={errorFor("avatarUrl")}
          />
        </div>
      </section>
      )}

      {section === "links" && (
      <section className="border-t border-[#2b2a24] pt-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
            02 / Links
          </p>
          <h2 className="mt-1.5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">
            Around the web
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#969287]">
            Add the destinations visitors should use to learn more about your work.
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <TextField
            id="githubUrl"
            label="GitHub URL"
            type="url"
            inputMode="url"
            placeholder="https://github.com/username"
            defaultValue={initialProfile?.github_url ?? ""}
            maxLength={2048}
            disabled={isSaving}
            error={errorFor("githubUrl")}
          />
          <TextField
            id="websiteUrl"
            label="Personal website URL"
            type="url"
            inputMode="url"
            placeholder="https://your-site.dev"
            defaultValue={initialProfile?.website_url ?? ""}
            maxLength={2048}
            disabled={isSaving}
            error={errorFor("websiteUrl")}
          />
        </div>
      </section>
      )}

      {section === "stats" && (
      <section className="border-t border-[#2b2a24] pt-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
            03 / Coding statistics
          </p>
          <h2 className="mt-1.5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">
            Coding totals
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#969287]">
            Enter cumulative totals from any source you trust. Stack Stats does not
            collect code or track activity automatically.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const value = initialProfile?.[stat.column] ?? 0;

            return (
              <div key={stat.name}>
                <label
                  htmlFor={stat.name}
                  className="font-mono text-xs text-[#aaa69a]"
                >
                  {stat.label}
                </label>
                <input
                  id={stat.name}
                  name={stat.name}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  defaultValue={value}
                  disabled={isSaving}
                  aria-invalid={Boolean(errorFor(stat.name))}
                  aria-describedby={
                    errorFor(stat.name) ? `${stat.name}-error` : undefined
                  }
                  className={`${inputClass} font-mono`}
                />
                {errorFor(stat.name) && (
                  <p id={`${stat.name}-error`} className="mt-1.5 text-xs text-[#e58b83]">
                    {errorFor(stat.name)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}

      {section === "languages" && (
      <section className="border-t border-[#2b2a24] pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55a7ff]">
              04 / Language activity
            </p>
            <h2 className="mt-1.5 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">
              Languages
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#969287]">
              Optional. If added, percentages must total 100%.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLanguages((current) => [...current, createRow()])}
            disabled={isSaving || languages.length >= 12}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[3px] border border-[#3b3931] px-3.5 font-mono text-xs text-[#c8c4b9] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-4" />
            Add language
          </button>
        </div>

        {errorFor("languages") && (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#e58b83]" role="alert">
            <AlertCircle className="size-4 shrink-0" />
            {errorFor("languages")}
          </p>
        )}

        {languages.length > 0 ? (
          <div className="mt-6 space-y-3">
            {languages.map((language, index) => {
              const nameError = errorFor(`languages.${index}.name`);
              const percentageError = errorFor(`languages.${index}.percentage`);

              return (
                <fieldset
                  key={language.rowId}
                  className="grid gap-3 border-b border-[#2b2a24] py-4 sm:grid-cols-[1fr_9rem_auto] sm:items-start"
                >
                  <legend className="sr-only">Language {index + 1}</legend>
                  <div>
                    <label
                      htmlFor={`language-name-${language.rowId}`}
                      className="font-mono text-[11px] text-[#969287]"
                    >
                      Language
                    </label>
                    <input
                      id={`language-name-${language.rowId}`}
                      type="text"
                      value={language.name}
                      maxLength={40}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateLanguage(language.rowId, "name", event.target.value)
                      }
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={
                        nameError ? `language-name-error-${language.rowId}` : undefined
                      }
                      placeholder="TypeScript"
                      className={inputClass}
                    />
                    {nameError && (
                      <p
                        id={`language-name-error-${language.rowId}`}
                        className="mt-1.5 text-xs text-[#e58b83]"
                      >
                        {nameError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor={`language-percentage-${language.rowId}`}
                      className="font-mono text-[11px] text-[#969287]"
                    >
                      Percentage
                    </label>
                    <div className="relative">
                      <input
                        id={`language-percentage-${language.rowId}`}
                        type="number"
                        inputMode="decimal"
                        min={0.01}
                        max={100}
                        step={0.01}
                        value={language.percentage}
                        disabled={isSaving}
                        onChange={(event) =>
                          updateLanguage(
                            language.rowId,
                            "percentage",
                            event.target.value,
                          )
                        }
                        aria-invalid={Boolean(percentageError)}
                        aria-describedby={
                          percentageError
                            ? `language-percentage-error-${language.rowId}`
                            : undefined
                        }
                        placeholder="50"
                        className={`${inputClass} pr-8 font-mono`}
                      />
                      <span className="pointer-events-none absolute right-3 top-[1.15rem] text-sm text-[#77746b]">
                        %
                      </span>
                    </div>
                    {percentageError && (
                      <p
                        id={`language-percentage-error-${language.rowId}`}
                        className="mt-1.5 text-xs text-[#e58b83]"
                      >
                        {percentageError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLanguage(language.rowId)}
                    disabled={isSaving}
                    aria-label={`Remove ${language.name || `language ${index + 1}`}`}
                    className="mt-5 inline-flex size-11 items-center justify-center rounded-[3px] border border-[#34332c] text-[#77746b] transition hover:border-[#8d4f49] hover:text-[#e58b83] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e58b83] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </fieldset>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 border border-dashed border-[#34332c] px-5 py-8 text-center">
            <p className="text-sm text-[#858177]">No languages added yet.</p>
          </div>
        )}
      </section>
      )}

      <div className="sticky bottom-0 z-10 border border-[#34332c] bg-[#11110d] p-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0" aria-live="polite">
          {feedback ? (
            <p
              className="flex items-start gap-2 text-sm text-[#e58b83]"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{feedback.message}</span>
            </p>
          ) : (
            <p className="px-1 text-xs text-[#77746b]">
              Saved profiles are publicly readable.
            </p>
          )}
        </div>
        <div className="mt-3 flex shrink-0 gap-2 sm:mt-0 sm:pl-4">
          <Link
            href={
              initialProfile ? `/u/${initialProfile.username}` : "/dashboard"
            }
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
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  error?: string;
  disabled?: boolean;
  maxLength?: number;
  type?: "text" | "url";
  inputMode?: "text" | "url";
};

function TextField({
  id,
  label,
  placeholder,
  defaultValue,
  error,
  disabled,
  maxLength,
  type = "text",
  inputMode = "text",
}: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="font-mono text-xs text-[#c8c4b9]">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-[#e58b83]">
          {error}
        </p>
      )}
    </div>
  );
}
