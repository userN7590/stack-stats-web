import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/profile-view";
import type { PublicProfile } from "@/lib/types";

export const metadata: Metadata = {
  title: "Example profile",
  description: "See what a completed Stack Stats developer profile looks like.",
};

const exampleProfile: PublicProfile = {
  user_id: "example",
  username: "alex",
  display_name: "Alex Rivera",
  bio: "Product-minded full-stack engineer building thoughtful tools for the web. I care about clear interfaces, dependable systems, and shipping work people enjoy using.",
  avatar_url: null,
  github_url: "https://github.com/",
  website_url: "https://example.com/",
  lines_added: 184290,
  lines_removed: 61420,
  files_changed: 2481,
  edit_events: 12834,
  projects_count: 27,
  coding_minutes: 38572,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-08-27T00:00:00.000Z",
  languages: [
    {
      id: "example-typescript",
      user_id: "example",
      name: "TypeScript",
      percentage: 62,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "example-python",
      user_id: "example",
      name: "Python",
      percentage: 24,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "example-css",
      user_id: "example",
      name: "CSS",
      percentage: 14,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

export default function ExamplePage() {
  return <ProfileView profile={exampleProfile} isExample />;
}
