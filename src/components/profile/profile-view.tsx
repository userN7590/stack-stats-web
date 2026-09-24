import { ArrowLeft, Pencil, UserPlus } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Avatar } from "@/components/profile/avatar";
import { ProfileLayoutEditor } from "@/components/profile/profile-layout-editor";
import { ProfileModules } from "@/components/profile/profile-modules";
import { ProfileBackground } from "@/components/profile/profile-background";
import { AppNavbar } from "@/components/ui/app-navbar";
import { Logo } from "@/components/ui/logo";
import {
  getDisplayFontClass,
  normalizeBackgroundStyle,
} from "@/lib/appearance";
import { normalizeProfileLayout } from "@/lib/profile-layout";
import type { PublicProfile } from "@/lib/types";

type ProfileViewProps = {
  profile: PublicProfile;
  isExample?: boolean;
  isOwner?: boolean;
  customize?: boolean;
};

export function ProfileView({
  profile,
  isExample = false,
  isOwner = false,
  customize = false,
}: ProfileViewProps) {
  const name = profile.display_name || profile.username;
  const isSynced = profile.stats_source === "synced";
  const displayFontClass = getDisplayFontClass(profile.display_font);
  const backgroundStyle = normalizeBackgroundStyle(profile.background_style);
  const editing = isOwner && !isExample && customize;
  const layout = normalizeProfileLayout(profile.profile_layout);

  return (
    <main className="relative isolate min-h-screen overflow-x-hidden bg-[#11110d] text-[#edeae0]">
      <ProfileBackground style={backgroundStyle} />

      <AppNavbar>
        {isOwner && !isExample ? (
          <>
            <Link
              href="/"
              className="font-mono text-xs text-[#aaa69a] underline decoration-[#444239] underline-offset-4 transition hover:text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
            >
              Home
            </Link>
            <LogoutButton />
          </>
        ) : (
          <Link
            href={isExample ? "/" : "/signup"}
            aria-label={isExample ? "Back home" : "Create your profile"}
            className="inline-flex size-10 items-center justify-center gap-2 font-mono text-xs text-[#aaa69a] underline decoration-[#444239] underline-offset-4 transition hover:text-[#edeae0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff] sm:size-auto"
          >
            {isExample ? (
              <ArrowLeft className="size-3.5" />
            ) : (
              <UserPlus className="size-4 sm:hidden" />
            )}
            <span className={isExample ? "" : "sr-only sm:not-sr-only"}>
              {isExample ? "Back home" : "Create your profile"}
            </span>
          </Link>
        )}
      </AppNavbar>

      <div className="relative z-10 mx-auto max-w-[840px] px-5 py-10 sm:px-8 sm:py-16">
        {isExample && (
          <p className="mb-8 border-l-2 border-[#55a7ff] pl-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#aaa69a]">
            Example profile
          </p>
        )}

        <header className="border-b border-[#2b2a24] pb-10 sm:pb-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <Avatar name={name} src={profile.avatar_url} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h1
                  className={`${displayFontClass} min-w-0 text-4xl leading-[1.05] tracking-[-0.035em] text-[#edeae0] sm:text-5xl`}
                >
                  {name}
                </h1>
                {isOwner && !isExample && !editing && (
                  <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 sm:flex-col sm:items-end">
                    <Link
                      href={`/u/${profile.username}?customize=1`}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-[3px] border border-[#3b3931] px-2.5 font-mono text-[10px] text-[#aaa69a] transition hover:border-[#55a7ff] hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                      Customize profile
                    </Link>
                    <Link
                      href="/settings/sync"
                      className="inline-flex min-h-8 items-center font-mono text-[10px] text-[#858177] underline decoration-[#444239] underline-offset-4 transition hover:text-[#55a7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a7ff]"
                    >
                      Sync settings
                    </Link>
                  </div>
                )}
              </div>
              <p className="mt-2 font-mono text-sm text-[#55a7ff]">
                @{profile.username}
              </p>

              {profile.bio && (
                <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#b8b4a9] sm:text-base">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </header>

        {editing ? (
          <ProfileLayoutEditor key={profile.user_id} profile={profile} />
        ) : (
          <ProfileModules profile={profile} layout={layout} isOwner={isOwner && !isExample} />
        )}

        <footer className="flex flex-col gap-4 border-t border-[#2b2a24] py-7 text-[11px] text-[#858177] sm:flex-row sm:items-center sm:justify-between">
          <p>
            {isSynced
              ? "Statistics are automatically tracked by Stack Stats."
              : "Statistics are entered and maintained by the profile owner."}
          </p>
          <div className="flex items-center gap-3">
            <span>Made with Stack Stats</span>
            <Logo compact />
          </div>
        </footer>
      </div>
    </main>
  );
}
