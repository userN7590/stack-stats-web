import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Stack Stats — Your development, quantified",
    template: "%s · Stack Stats",
  },
  description:
    "Create a polished public developer profile from the aggregate coding statistics you enter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full bg-[#11110d] antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
