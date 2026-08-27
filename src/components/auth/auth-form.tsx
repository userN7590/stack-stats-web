"use client";

import { AlertCircle, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { authSchema } from "@/lib/validation";

type AuthFormProps = {
  mode: "login" | "signup";
  initialError?: string;
};

type Feedback = {
  type: "error" | "success";
  message: string;
} | null;

export function AuthForm({ mode, initialError }: AuthFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(
    initialError ? { type: "error", message: initialError } : null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFeedback(null);
    setFieldErrors({});

    const formData = new FormData(form);
    const result = authSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: isSignup ? formData.get("confirmPassword") : undefined,
    });

    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = String(issue.path[0]);
        nextErrors[field] ??= issue.message;
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: result.data.email,
          password: result.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setFeedback({
          type: "success",
          message:
            "Account created. Check your inbox to confirm your email, then return here to log in.",
        });
        form.reset();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password,
        });

        if (error) throw error;

        router.replace("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 hover:border-white/15 focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          placeholder="you@example.com"
          className={inputClass}
        />
        {fieldErrors.email && (
          <p id="email-error" className="mt-1.5 text-xs text-rose-300">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="mt-5">
        <label htmlFor="password" className="text-sm font-medium text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={8}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          placeholder="At least 8 characters"
          className={inputClass}
        />
        {fieldErrors.password && (
          <p id="password-error" className="mt-1.5 text-xs text-rose-300">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {isSignup && (
        <div className="mt-5">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-zinc-300"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword ? "confirm-password-error" : undefined
            }
            placeholder="Repeat your password"
            className={inputClass}
          />
          {fieldErrors.confirmPassword && (
            <p id="confirm-password-error" className="mt-1.5 text-xs text-rose-300">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`mt-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-5 ${
            feedback.type === "success"
              ? "border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200"
              : "border-rose-300/15 bg-rose-400/[0.07] text-rose-200"
          }`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="group mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-[#07110d] transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0c100e] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            {isSignup ? "Creating account…" : "Logging in…"}
          </>
        ) : (
          <>
            {isSignup ? "Create account" : "Log in"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <p className="mt-6 text-center text-sm text-zinc-600">
        {isSignup ? "Already have an account?" : "New to Stack Stats?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-zinc-300 underline decoration-white/15 underline-offset-4 transition hover:text-white"
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
