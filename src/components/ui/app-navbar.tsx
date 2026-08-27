import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

type AppNavbarProps = {
  children?: ReactNode;
  className?: string;
};

export function AppNavbar({ children, className = "" }: AppNavbarProps) {
  return (
    <nav className={`relative z-30 border-b border-[#2b2a24] ${className}`}>
      <div className="relative mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
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
