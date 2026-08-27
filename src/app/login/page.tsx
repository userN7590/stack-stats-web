import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "confirmation"
      ? "That confirmation link is invalid or has expired. Request a new link by signing up again."
      : undefined;

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to your profile"
      description="Update your public profile and keep your coding totals current."
    >
      <AuthForm mode="login" initialError={initialError} />
    </AuthShell>
  );
}
