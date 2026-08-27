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
            "Check your email to confirm your account. After confirmation, you’ll be sent to your dashboard.",
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
    "mt-2 h-11 w-full rounded-[3px] border border-[#34332c] bg-[#171712] px-3.5 text-sm text-[#edeae0] outline-none transition placeholder:text-[#68655d] hover:border-[#4a483f] focus:border-[#55a7ff] focus:ring-2 focus:ring-[#55a7ff]/20 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="email" className="font-mono text-xs text-[#c8c4b9]">
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
          <p id="email-error" className="mt-1.5 text-xs text-[#e58b83]">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="mt-5">
        <label htmlFor="password" className="font-mono text-xs text-[#c8c4b9]">
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
          <p id="password-error" className="mt-1.5 text-xs text-[#e58b83]">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {isSignup && (
        <div className="mt-5">
          <label
            htmlFor="confirmPassword"
            className="font-mono text-xs text-[#c8c4b9]"
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
            <p id="confirm-password-error" className="mt-1.5 text-xs text-[#e58b83]">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`mt-5 flex items-start gap-2.5 rounded-[3px] border px-3.5 py-3 text-sm leading-5 ${
            feedback.type === "success"
              ? "border-[#356a4d] bg-[#17251b] text-[#8ed8aa]"
              : "border-[#70413d] bg-[#251614] text-[#e7a39d]"
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
        className="group mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-[#55a7ff] px-5 font-mono text-xs font-semibold text-[#0b1722] transition hover:bg-[#78b8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#11110d] disabled:cursor-not-allowed disabled:opacity-60"
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

      <p className="mt-6 text-center text-sm text-[#858177]">
        {isSignup ? "Already have an account?" : "New to Stack Stats?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-[#c8c4b9] underline decoration-[#444239] underline-offset-4 transition hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
