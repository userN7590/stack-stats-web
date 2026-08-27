begin;

alter table public.profiles
  add column display_font text not null default 'editorial',
  add column background_style text not null default 'none',
  add constraint profiles_display_font_check check (
    display_font in ('editorial', 'modern', 'terminal', 'display', 'signature')
  ),
  add constraint profiles_background_style_check check (
    background_style in ('none', 'aurora', 'signal', 'blueprint', 'ember')
  );

create or replace function public.update_profile_appearance(
  p_display_font text,
  p_background_style text
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

  if p_display_font is null or p_display_font not in (
    'editorial', 'modern', 'terminal', 'display', 'signature'
  ) then
    raise exception 'Invalid display font.' using errcode = '22023';
  end if;

  if p_background_style is null or p_background_style not in (
    'none', 'aurora', 'signal', 'blueprint', 'ember'
  ) then
    raise exception 'Invalid background style.' using errcode = '22023';
  end if;

  update public.profiles
  set
    display_font = p_display_font,
    background_style = p_background_style
  where user_id = current_user_id;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.update_profile_appearance(text, text)
from public, anon;

grant execute on function public.update_profile_appearance(text, text)
to authenticated;

commit;
