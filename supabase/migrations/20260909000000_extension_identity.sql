begin;

-- Identity-only delegation from existing Supabase users. No telemetry grants.
create table public.extension_auth_codes (
  code_hash text primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  challenge text not null,
  redirect_uri text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 seconds'
);
create index extension_codes_owner_time on public.extension_auth_codes(user_id, created_at);
create table public.extension_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  refresh_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index extension_connections_owner on public.extension_connections(user_id);
create table public.extension_access_tokens (
  token_hash text primary key,
  connection_id uuid not null references public.extension_connections(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index extension_access_connection on public.extension_access_tokens(connection_id);
alter table public.extension_auth_codes enable row level security;
alter table public.extension_connections enable row level security;
alter table public.extension_access_tokens enable row level security;
revoke all on public.extension_auth_codes, public.extension_connections, public.extension_access_tokens from public, anon, authenticated;

-- Definer functions are necessary for code/token possession checks by anon.
-- No caller can read hashes, choose an owner, or mutate a profile through them.
create function public.extension_authorize(p_challenge text, p_redirect_uri text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_code text;
begin
  if v_user is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  if not exists(select 1 from public.profiles where user_id = v_user) then
    raise exception 'profile_required' using errcode = 'P0002';
  end if;
  if p_challenge is null or p_challenge !~ '^[A-Za-z0-9_-]{43}$'
    or p_redirect_uri is null or length(p_redirect_uri) > 2048 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  -- Serialize per-account grant creation and bound retained connection counts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  delete from public.extension_auth_codes where user_id = v_user and created_at < now() - interval '10 minutes';
  delete from public.extension_connections where user_id = v_user and expires_at <= now();
  if (select count(*) from public.extension_auth_codes where user_id = v_user) >= 10
    or (select count(*) from public.extension_connections where user_id = v_user) >= 20 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  v_code := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.extension_auth_codes(code_hash, user_id, challenge, redirect_uri)
    values (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_user, p_challenge, p_redirect_uri);
  return v_code;
end $$;

create function public.extension_exchange(p_code text, p_verifier text, p_redirect_uri text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_grant public.extension_auth_codes; v_connection public.extension_connections;
  v_refresh text; v_access text; v_profile public.profiles;
begin
  if p_code is null or p_code !~ '^[a-f0-9]{64}$' or p_verifier is null or p_verifier !~ '^[A-Za-z0-9._~-]{43,128}$' then
    raise exception 'invalid_grant' using errcode = '28000';
  end if;
  -- Atomic consumption: concurrent exchanges cannot both succeed. A wrong
  -- verifier does not consume someone else's grant.
  delete from public.extension_auth_codes where code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
    and expires_at > now() and redirect_uri = p_redirect_uri
    and challenge = rtrim(translate(encode(extensions.digest(p_verifier, 'sha256'), 'base64'), '+/', '-_'), '=')
    returning * into v_grant;
  if not found then raise exception 'invalid_grant' using errcode = '28000'; end if;
  select * into strict v_profile from public.profiles where user_id = v_grant.user_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_grant.user_id::text, 0));
  if (select count(*) from public.extension_connections where user_id = v_grant.user_id and expires_at > now()) >= 20 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  v_refresh := encode(extensions.gen_random_bytes(32), 'hex');
  v_access := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.extension_connections(user_id, refresh_hash)
    values(v_grant.user_id, encode(extensions.digest(v_refresh, 'sha256'), 'hex')) returning * into v_connection;
  insert into public.extension_access_tokens(token_hash, connection_id)
    values(encode(extensions.digest(v_access, 'sha256'), 'hex'), v_connection.id);
  return jsonb_build_object('accessToken', v_access, 'refreshToken', v_refresh,
    'expiresAt', now() + interval '15 minutes', 'refreshExpiresAt', v_connection.expires_at,
    'account', jsonb_build_object('userId', v_profile.user_id, 'username', v_profile.username, 'displayName', v_profile.display_name));
end $$;

create function public.extension_refresh(p_refresh_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_connection public.extension_connections; v_profile public.profiles; v_access text;
begin
  if p_refresh_token is null or p_refresh_token !~ '^[a-f0-9]{64}$' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select * into v_connection from public.extension_connections
    where refresh_hash = encode(extensions.digest(p_refresh_token, 'sha256'), 'hex') and expires_at > now() for update;
  if not found then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into strict v_profile from public.profiles where user_id = v_connection.user_id;
  delete from public.extension_access_tokens where connection_id = v_connection.id and expires_at <= now();
  if (select count(*) from public.extension_access_tokens where connection_id = v_connection.id) >= 64 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  v_access := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.extension_access_tokens(token_hash, connection_id)
    values(encode(extensions.digest(v_access, 'sha256'), 'hex'), v_connection.id);
  -- Fixed absolute expiry; refresh never extends the 30-day delegation. The
  -- identity-only refresh credential is stable across editor windows/retries.
  return jsonb_build_object('accessToken', v_access, 'refreshToken', p_refresh_token,
    'expiresAt', now() + interval '15 minutes', 'refreshExpiresAt', v_connection.expires_at,
    'account', jsonb_build_object('userId', v_profile.user_id, 'username', v_profile.username, 'displayName', v_profile.display_name));
end $$;

create function public.extension_account(p_access_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles;
begin
  if p_access_token is null or p_access_token !~ '^[a-f0-9]{64}$' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select p.* into v_profile from public.extension_access_tokens a
    join public.extension_connections c on c.id = a.connection_id
    join public.profiles p on p.user_id = c.user_id
    where a.token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex') and a.expires_at > now() and c.expires_at > now();
  if not found then raise exception 'unauthorized' using errcode = '28000'; end if;
  return jsonb_build_object('userId', v_profile.user_id, 'username', v_profile.username, 'displayName', v_profile.display_name);
end $$;

create function public.extension_revoke(p_refresh_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_refresh_token is not null and p_refresh_token ~ '^[a-f0-9]{64}$' then
    delete from public.extension_connections where refresh_hash = encode(extensions.digest(p_refresh_token, 'sha256'), 'hex');
  end if;
end $$;

create function public.extension_revoke_all()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.extension_connections where user_id = auth.uid();
  delete from public.extension_auth_codes where user_id = auth.uid();
end $$;

revoke all on function public.extension_authorize(text,text), public.extension_exchange(text,text,text),
  public.extension_refresh(text), public.extension_account(text), public.extension_revoke(text), public.extension_revoke_all() from public, anon, authenticated;
grant execute on function public.extension_authorize(text,text), public.extension_revoke_all() to authenticated;
grant execute on function public.extension_exchange(text,text,text), public.extension_refresh(text), public.extension_account(text), public.extension_revoke(text) to anon, authenticated;

commit;
