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
      ? "We could not confirm that account. The link may be invalid or expired; start signup again to request a new confirmation email."
      : undefined;

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to your profile"
      description="Update your public profile and keep your coding totals current."
      alternateHref="/signup"
      alternateLabel="Create profile"
    >
      <AuthForm mode="login" initialError={initialError} />
    </AuthShell>
  );
}
