import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileLanguage } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const [{ data: profile, error: profileError }, { data: languages, error: languageError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("profile_languages")
        .select("*")
        .eq("user_id", userId)
        .order("percentage", { ascending: false }),
    ]);

  if (profileError || languageError) {
    throw new Error(
      profileError?.message || languageError?.message || "Could not load your profile.",
    );
  }

  const email =
    typeof claimsData.claims.email === "string"
      ? claimsData.claims.email
      : "Signed-in account";

  return (
    <main className="min-h-screen bg-[#070a09] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-28rem] size-[52rem] -translate-x-1/2 rounded-full bg-emerald-400/[0.06] blur-[120px]" />
        <div className="profile-grid absolute inset-0 opacity-20" />
      </div>

      <nav className="relative z-20 border-b border-white/[0.06] bg-[#070a09]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-xs text-zinc-600 md:inline">
              {email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="relative z-[1] mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <header className="mb-9">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300/70">
            Profile editor
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
            {profile ? "Keep your story current." : "Build your public profile."}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
            Add the details and aggregate totals you want to share. You can return
            here to update them whenever your work changes.
          </p>
        </header>

        <ProfileForm
          initialProfile={(profile as Profile | null) ?? null}
          initialLanguages={(languages as ProfileLanguage[] | null) ?? []}
        />
      </div>
    </main>
  );
}
