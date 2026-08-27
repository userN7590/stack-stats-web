import type { BackgroundStyle, DisplayFont } from "@/lib/appearance";

export type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  github_url: string | null;
  website_url: string | null;
  lines_added: number;
  lines_removed: number;
  files_changed: number;
  edit_events: number;
  projects_count: number;
  coding_minutes: number;
  display_font: DisplayFont;
  background_style: BackgroundStyle;
  created_at: string;
  updated_at: string;
};

export type ProfileLanguage = {
  id: string;
  user_id: string;
  name: string;
  percentage: number;
  created_at: string;
};

export type PublicProfile = Profile & {
  languages: ProfileLanguage[];
};
