import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/profile-view";
import { exampleProfile } from "@/lib/example-profile";

export const metadata: Metadata = {
  title: "Example profile",
  description: "See what a completed Stack Stats developer profile looks like.",
};

export default function ExamplePage() {
  return <ProfileView profile={exampleProfile} isExample />;
}
