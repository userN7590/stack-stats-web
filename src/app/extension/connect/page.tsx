import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ExtensionConsent, RevokeExtensionConnections } from "@/components/auth/extension-consent";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { createClient } from "@/lib/supabase/server";
import { callbackUrl, linkSchema, validRedirect } from "@/lib/extension-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connect VS Code", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ExtensionConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const management = Object.keys(params).length === 0;
  const parsed = linkSchema.safeParse(params);
  if (!management && (!parsed.success || !validRedirect(parsed.data.redirectUri))) return <AuthShell eyebrow="Editor connection" title="Invalid connection request" description="Start a new connection from the Stack Stats extension. No account was connected." alternateHref="/" alternateLabel="Home"><p>The callback or authorization request is not supported.</p></AuthShell>;
  const request = parsed.success ? parsed.data : undefined;
  const destination = `/extension/connect${request ? `?${new URLSearchParams(Object.entries(request).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}` : ""}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(`/login?next=${encodeURIComponent(destination)}`);
  const { data: profile, error: profileError } = await supabase.from("profiles").select("user_id,username,display_name").eq("user_id", data.user.id).maybeSingle();
  if (profileError) throw new Error("Account identity could not be loaded. Try again shortly.");
  return <AuthShell eyebrow="Stack Stats for VS Code" title={management ? "Your editor connections" : profile ? "Connect your account" : "Choose your profile identity"} description="Local tracking always works without an account or an internet connection." alternateHref="/dashboard" alternateLabel="Your profile">
    {management ? <RevokeExtensionConnections /> : !profile ? <>
      <p className="mb-6 text-sm leading-6">Choose a username using the existing profile setup. You will return here to approve your editor connection.</p>
      <ProfileForm initialProfile={null} initialLanguages={[]} section="identity" successDestination={destination} />
    </> : <ExtensionConsent request={request!} username={profile.username} cancelUrl={callbackUrl(request!.redirectUri, request!.state, { error: "access_denied" })} />}
  </AuthShell>;
}
