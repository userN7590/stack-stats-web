"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCode2,
  FolderKanban,
  LoaderCircle,
  Minus,
  MousePointer2,
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
};

type LanguageRow = {
  rowId: string;
  name: string;
  percentage: string;
};

type Feedback = {
  type: "error" | "success";
  message: string;
} | null;

const stats = [
  { name: "linesAdded", label: "Lines added", column: "lines_added", icon: Plus },
  { name: "linesRemoved", label: "Lines removed", column: "lines_removed", icon: Minus },
  { name: "filesChanged", label: "Files changed", column: "files_changed", icon: FileCode2 },
  { name: "editEvents", label: "Edit events", column: "edit_events", icon: MousePointer2 },
  { name: "projectsCount", label: "Projects worked on", column: "projects_count", icon: FolderKanban },
  { name: "codingMinutes", label: "Coding time (minutes)", column: "coding_minutes", icon: Clock3 },
] as const;

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 hover:border-white/15 focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-400/[0.06] disabled:cursor-not-allowed disabled:opacity-60";

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
  const [savedUsername, setSavedUsername] = useState(
    initialProfile?.username ?? "",
  );

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
      username: formData.get("username"),
      displayName: formData.get("displayName"),
      bio: formData.get("bio"),
      avatarUrl: formData.get("avatarUrl"),
      githubUrl: formData.get("githubUrl"),
      websiteUrl: formData.get("websiteUrl"),
      linesAdded: formData.get("linesAdded"),
      linesRemoved: formData.get("linesRemoved"),
      filesChanged: formData.get("filesChanged"),
      editEvents: formData.get("editEvents"),
      projectsCount: formData.get("projectsCount"),
      codingMinutes: formData.get("codingMinutes"),
      languages,
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
        type: "error",
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

      setSavedUsername(result.data.username);
      setLanguages(
        result.data.languages.map((language) => ({
          rowId: language.rowId,
          name: language.name,
          percentage: String(language.percentage),
        })),
      );
      setFeedback({
        type: "success",
        message: "Profile saved. Your public page is up to date.",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
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
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="rounded-2xl border border-white/[0.07] bg-[#0b0f0d] p-5 sm:p-7">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/65">
            Identity
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-100">
            Public profile
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Choose what people see when they open your profile.
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="username" className="text-sm font-medium text-zinc-300">
              Username <span className="text-emerald-300">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-[1.15rem] font-mono text-sm text-zinc-600">
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
              <p id="username-error" className="mt-1.5 text-xs text-rose-300">
                {errorFor("username")}
              </p>
            ) : (
              <p id="username-help" className="mt-1.5 text-xs text-zinc-700">
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
          <label htmlFor="bio" className="text-sm font-medium text-zinc-300">
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
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-700 hover:border-white/15 focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-400/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
          />
          {errorFor("bio") ? (
            <p id="bio-error" className="mt-1.5 text-xs text-rose-300">
              {errorFor("bio")}
            </p>
          ) : (
            <p id="bio-help" className="mt-1.5 text-xs text-zinc-700">
              Up to 280 characters.
            </p>
          )}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
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
          <div className="sm:col-span-2">
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
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-[#0b0f0d] p-5 sm:p-7">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/65">
            Aggregate data
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-100">
            Coding totals
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Enter cumulative totals from any source you trust. Stack Stats does not
            collect code or track activity automatically.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const value = initialProfile?.[stat.column] ?? 0;

            return (
              <div key={stat.name}>
                <label
                  htmlFor={stat.name}
                  className="flex items-center gap-2 text-xs font-medium text-zinc-400"
                >
                  <Icon className="size-3.5 text-zinc-600" />
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
                  <p id={`${stat.name}-error`} className="mt-1.5 text-xs text-rose-300">
                    {errorFor(stat.name)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-[#0b0f0d] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/65">
              Breakdown
            </p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-100">
              Languages
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Optional. If added, percentages must total 100%.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLanguages((current) => [...current, createRow()])}
            disabled={isSaving || languages.length >= 12}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-4" />
            Add language
          </button>
        </div>

        {errorFor("languages") && (
          <p className="mt-4 flex items-center gap-2 text-sm text-rose-300" role="alert">
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
                  className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-[1fr_9rem_auto] sm:items-start"
                >
                  <legend className="sr-only">Language {index + 1}</legend>
                  <div>
                    <label
                      htmlFor={`language-name-${language.rowId}`}
                      className="text-xs font-medium text-zinc-500"
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
                        className="mt-1.5 text-xs text-rose-300"
                      >
                        {nameError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor={`language-percentage-${language.rowId}`}
                      className="text-xs font-medium text-zinc-500"
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
                      <span className="pointer-events-none absolute right-3 top-[1.15rem] text-sm text-zinc-600">
                        %
                      </span>
                    </div>
                    {percentageError && (
                      <p
                        id={`language-percentage-error-${language.rowId}`}
                        className="mt-1.5 text-xs text-rose-300"
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
                    className="mt-5 inline-flex size-11 items-center justify-center rounded-xl border border-white/[0.07] text-zinc-600 transition hover:border-rose-300/20 hover:bg-rose-400/[0.06] hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </fieldset>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-white/[0.08] px-5 py-8 text-center">
            <p className="text-sm text-zinc-600">No languages added yet.</p>
          </div>
        )}
      </section>

      <div className="sticky bottom-3 z-10 rounded-2xl border border-white/10 bg-[#0b0f0d]/95 p-3 shadow-[0_15px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0" aria-live="polite">
          {feedback ? (
            <p
              className={`flex items-start gap-2 text-sm ${
                feedback.type === "success" ? "text-emerald-300" : "text-rose-300"
              }`}
              role={feedback.type === "error" ? "alert" : "status"}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </p>
          ) : (
            <p className="px-1 text-xs text-zinc-700">
              Saved profiles are publicly readable.
            </p>
          )}
        </div>
        <div className="mt-3 flex shrink-0 gap-2 sm:mt-0 sm:pl-4">
          {savedUsername && (
            <Link
              href={`/u/${savedUsername}`}
              target="_blank"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:flex-none"
            >
              View profile
              <ExternalLink className="size-4" />
            </Link>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-[#07110d] transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f0d] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            {isSaving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving ? "Saving…" : "Save profile"}
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
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
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
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
