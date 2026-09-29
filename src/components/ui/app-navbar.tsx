import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

type AppNavbarProps = {
  children?: ReactNode;
  className?: string;
  /** Continue the page's frame rails through the navigation. */
  rails?: boolean;
};

/** Shares the 1,080px site/profile frame so actions align with page content. */
export function AppNavbar({ children, className = "", rails = false }: AppNavbarProps) {
  return (
    <nav className={`grid-rule relative z-30 border-b border-[#2b2a24] ${className}`}>
      <div className={`site-inset relative mx-auto flex h-16 w-[calc(100%-2rem)] max-w-[1080px] items-center ${rails ? "nav-rails" : ""}`}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Logo />
        </div>
        {children && (
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            {children}
          </div>
        )}
      </div>
    </nav>
  );
}
