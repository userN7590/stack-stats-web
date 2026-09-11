import type { Metadata } from "next";
import { safeAuthDestination } from "@/lib/auth-destination";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Create an account",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const destination = safeAuthDestination((await searchParams).next);
  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      description="Add the statistics you choose and publish a developer profile under your username."
      alternateHref={`/login?next=${encodeURIComponent(destination)}`}
      alternateLabel="Log in"
    >
      <AuthForm mode="signup" next={destination} />
    </AuthShell>
  );
}
