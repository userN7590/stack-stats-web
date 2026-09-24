import type { Metadata } from "next";
import { safeAuthDestination } from "@/lib/auth-destination";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const destination = safeAuthDestination(next);
  const initialError =
    error === "confirmation"
      ? "We could not confirm that account. The link may be invalid or expired; start signup again to request a new confirmation email."
      : undefined;

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to your profile"
      description="Update your public profile and keep your coding totals current."
      alternateHref={`/signup?next=${encodeURIComponent(destination)}`}
      alternateLabel="Create profile"
    >
      <AuthForm mode="login" initialError={initialError} next={destination} />
    </AuthShell>
  );
}
