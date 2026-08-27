begin;

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  bio text,
  avatar_url text,
  github_url text,
  website_url text,
  lines_added bigint not null default 0,
  lines_removed bigint not null default 0,
  files_changed bigint not null default 0,
  edit_events bigint not null default 0,
  projects_count bigint not null default 0,
  coding_minutes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_format_check check (
    username = lower(username)
    and username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'
  ),
  constraint profiles_display_name_length_check check (
    display_name is null or char_length(display_name) <= 60
  ),
  constraint profiles_bio_length_check check (
    bio is null or char_length(bio) <= 280
  ),
  constraint profiles_avatar_url_check check (
    avatar_url is null
    or (char_length(avatar_url) <= 2048 and avatar_url ~* '^https?://')
  ),
  constraint profiles_github_url_check check (
    github_url is null
    or (char_length(github_url) <= 2048 and github_url ~* '^https?://(www\.)?github\.com(/|$)')
  ),
  constraint profiles_website_url_check check (
    website_url is null
    or (char_length(website_url) <= 2048 and website_url ~* '^https?://')
  ),
  constraint profiles_lines_added_check check (lines_added >= 0),
  constraint profiles_lines_removed_check check (lines_removed >= 0),
  constraint profiles_files_changed_check check (files_changed >= 0),
  constraint profiles_edit_events_check check (edit_events >= 0),
  constraint profiles_projects_count_check check (projects_count >= 0),
  constraint profiles_coding_minutes_check check (coding_minutes >= 0)
);

create table public.profile_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  name text not null,
  percentage numeric(5, 2) not null,
  created_at timestamptz not null default now(),

  constraint profile_languages_name_length_check check (
    char_length(trim(name)) between 1 and 40
  ),
  constraint profile_languages_percentage_check check (
    percentage > 0 and percentage <= 100
  )
);

create index profile_languages_user_id_idx
  on public.profile_languages(user_id);

create unique index profile_languages_user_id_name_idx
  on public.profile_languages(user_id, lower(name));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.save_profile(
  p_username text,
  p_display_name text,
  p_bio text,
  p_avatar_url text,
  p_github_url text,
  p_website_url text,
  p_lines_added bigint,
  p_lines_removed bigint,
  p_files_changed bigint,
  p_edit_events bigint,
  p_projects_count bigint,
  p_coding_minutes bigint,
  p_languages jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_languages, '[]'::jsonb)) <> 'array' then
    raise exception 'Languages must be a JSON array.' using errcode = '22023';
  end if;

  insert into public.profiles (
    user_id,
    username,
    display_name,
    bio,
    avatar_url,
    github_url,
    website_url,
    lines_added,
    lines_removed,
    files_changed,
    edit_events,
    projects_count,
    coding_minutes
  )
  values (
    current_user_id,
    p_username,
    nullif(trim(p_display_name), ''),
    nullif(trim(p_bio), ''),
    nullif(trim(p_avatar_url), ''),
    nullif(trim(p_github_url), ''),
    nullif(trim(p_website_url), ''),
    p_lines_added,
    p_lines_removed,
    p_files_changed,
    p_edit_events,
    p_projects_count,
    p_coding_minutes
  )
  on conflict (user_id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    bio = excluded.bio,
    avatar_url = excluded.avatar_url,
    github_url = excluded.github_url,
    website_url = excluded.website_url,
    lines_added = excluded.lines_added,
    lines_removed = excluded.lines_removed,
    files_changed = excluded.files_changed,
    edit_events = excluded.edit_events,
    projects_count = excluded.projects_count,
    coding_minutes = excluded.coding_minutes;

  delete from public.profile_languages
  where user_id = current_user_id;

  insert into public.profile_languages (user_id, name, percentage)
  select
    current_user_id,
    trim(language ->> 'name'),
    (language ->> 'percentage')::numeric
  from jsonb_array_elements(coalesce(p_languages, '[]'::jsonb)) as language;
end;
$$;

alter table public.profiles enable row level security;
alter table public.profile_languages enable row level security;

create policy "Profiles are publicly readable"
on public.profiles
for select
to anon, authenticated
using (true);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own profile"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Languages are publicly readable"
on public.profile_languages
for select
to anon, authenticated
using (true);

create policy "Users can insert their own languages"
on public.profile_languages
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own languages"
on public.profile_languages
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own languages"
on public.profile_languages
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to anon, authenticated;
grant select on table public.profiles, public.profile_languages to anon, authenticated;
grant insert, update, delete on table public.profiles, public.profile_languages to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.save_profile(
  text, text, text, text, text, text,
  bigint, bigint, bigint, bigint, bigint, bigint, jsonb
) from public, anon;
grant execute on function public.save_profile(
  text, text, text, text, text, text,
  bigint, bigint, bigint, bigint, bigint, bigint, jsonb
) to authenticated;

commit;
