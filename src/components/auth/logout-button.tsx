"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogout() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not log out. Try again.",
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        aria-describedby={errorMessage ? "logout-error" : undefined}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        <span className="hidden sm:inline">Log out</span>
      </button>
      {errorMessage && (
        <p
          id="logout-error"
          role="alert"
          className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-rose-300/15 bg-[#180d10] px-3 py-2 text-xs leading-5 text-rose-200 shadow-xl"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
