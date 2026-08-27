import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Stack Stats — Your coding story, in numbers",
    template: "%s · Stack Stats",
  },
  description:
    "Create a polished public developer profile from the aggregate coding statistics you enter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full bg-[#070a09] antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
