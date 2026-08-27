import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      description="Add the statistics you choose and publish a developer profile under your username."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
