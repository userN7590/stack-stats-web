begin;
alter table public.extension_auth_codes add column scope text not null default 'identity' check(scope in ('identity','stats:write'));
alter table public.extension_connections add column scope text not null default 'identity' check(scope in ('identity','stats:write'));
create table public.extension_refresh_history (
 token_hash text primary key, connection_id uuid not null references public.extension_connections(id) on delete cascade,
 successor_hash text not null, created_at timestamptz not null default now()
);
create index extension_refresh_history_connection on public.extension_refresh_history(connection_id);
alter table public.extension_refresh_history enable row level security;
revoke all on public.extension_refresh_history from public, anon, authenticated;
create function public.extension_authorize_stats(p_challenge text, p_redirect_uri text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
 v_code := public.extension_authorize(p_challenge, p_redirect_uri);
 update public.extension_auth_codes set scope = 'stats:write' where code_hash = encode(extensions.digest(v_code,'sha256'),'hex');
 return v_code;
end $$;
create or replace function public.extension_exchange(p_code text, p_verifier text, p_redirect_uri text)
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
  insert into public.extension_connections(user_id, refresh_hash, scope)
    values(v_grant.user_id, encode(extensions.digest(v_refresh, 'sha256'), 'hex'), v_grant.scope) returning * into v_connection;
  insert into public.extension_access_tokens(token_hash, connection_id)
    values(encode(extensions.digest(v_access, 'sha256'), 'hex'), v_connection.id);
  return (case when v_connection.scope = 'stats:write' then jsonb_build_object('syncGrant', v_connection.id) else '{}'::jsonb end) || jsonb_build_object('accessToken', v_access, 'refreshToken', v_refresh,
    'expiresAt', now() + interval '15 minutes', 'refreshExpiresAt', v_connection.expires_at,
    'account', jsonb_build_object('userId', v_profile.user_id, 'username', v_profile.username, 'displayName', v_profile.display_name));
end $$;

create or replace function public.extension_refresh(p_refresh_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_connection public.extension_connections; v_profile public.profiles; v_access text;
begin
  if p_refresh_token is null or p_refresh_token !~ '^[a-f0-9]{64}$' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select * into v_connection from public.extension_connections
    where refresh_hash = encode(extensions.digest(p_refresh_token, 'sha256'), 'hex') and scope = 'identity' and expires_at > now() for update;
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


-- Client-proposed random successor is saved in SecretStorage before rotation.
-- Only the exact predecessor + current successor pair may recover a lost reply.
-- Reuse with a different successor revokes the family (return NULL so it commits).
create function public.extension_refresh_stats(p_refresh_token text, p_next_refresh_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.extension_connections; p public.profiles; a text;
 old_hash text := encode(extensions.digest(p_refresh_token,'sha256'),'hex');
 next_hash text := encode(extensions.digest(p_next_refresh_token,'sha256'),'hex');
begin
 if p_refresh_token is null or p_refresh_token !~ '^[a-f0-9]{64}$' or p_next_refresh_token is null or p_next_refresh_token !~ '^[a-f0-9]{64}$' or p_refresh_token = p_next_refresh_token then
  raise exception 'invalid_request' using errcode='22023';
 end if;
 select * into c from public.extension_connections where scope='stats:write' and expires_at > now()
 and (refresh_hash = old_hash or id in (select connection_id from public.extension_refresh_history where token_hash=old_hash)) for update;
 if not found then raise exception 'unauthorized' using errcode='28000'; end if;
 if c.refresh_hash <> old_hash and not exists(select 1 from public.extension_refresh_history where token_hash=old_hash and successor_hash=next_hash and c.refresh_hash=next_hash) then
  delete from public.extension_connections where id=c.id; return null;
 end if;
 delete from public.extension_access_tokens where connection_id=c.id and expires_at<=now();
 if (select count(*) from public.extension_access_tokens where connection_id=c.id)>=64 or (select count(*) from public.extension_refresh_history where connection_id=c.id)>=4096 then
  raise exception 'rate_limited' using errcode='54000';
 end if;
 if c.refresh_hash=old_hash then
  if exists(select 1 from public.extension_refresh_history where token_hash=next_hash) then raise exception 'invalid_request' using errcode='22023'; end if;
  insert into public.extension_refresh_history(token_hash,connection_id,successor_hash) values(old_hash,c.id,next_hash);
  update public.extension_connections set refresh_hash=next_hash where id=c.id;
 end if;
 select * into strict p from public.profiles where user_id=c.user_id;
 a := encode(extensions.gen_random_bytes(32),'hex');
 insert into public.extension_access_tokens(token_hash,connection_id) values(encode(extensions.digest(a,'sha256'),'hex'),c.id);
 return jsonb_build_object('accessToken',a,'refreshToken',p_next_refresh_token,'syncGrant',c.id,
 'expiresAt',now()+interval '15 minutes','refreshExpiresAt',c.expires_at,
 'account',jsonb_build_object('userId',p.user_id,'username',p.username,'displayName',p.display_name));
end $$;
create or replace function public.extension_revoke(p_refresh_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_refresh_token is not null and p_refresh_token ~ '^[a-f0-9]{64}$' then
  delete from public.extension_connections where refresh_hash=encode(extensions.digest(p_refresh_token,'sha256'),'hex')
   or id in(select connection_id from public.extension_refresh_history where token_hash=encode(extensions.digest(p_refresh_token,'sha256'),'hex'));
 end if;
end $$;
revoke all on function public.extension_authorize_stats(text,text), public.extension_refresh_stats(text,text) from public,anon,authenticated;
grant execute on function public.extension_authorize_stats(text,text) to authenticated;
grant execute on function public.extension_refresh_stats(text,text) to anon,authenticated;

create table public.sync_installations (
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 installation_id uuid not null, created_at timestamptz not null default now(), last_synced_at timestamptz not null default now(),
 primary key(user_id,installation_id)
);
create table public.sync_days (
 user_id uuid not null, installation_id uuid not null, date date not null,
 revision bigint not null check(revision>0 and revision<=1000000000000),
 payload jsonb not null, updated_at timestamptz not null default now(),
 primary key(user_id,installation_id,date),
 foreign key(user_id,installation_id) references public.sync_installations(user_id,installation_id) on delete cascade
);
create index sync_days_owner_date on public.sync_days(user_id,date);
create table public.sync_privacy (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 publish_profile boolean not null default false, publish_languages boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.sync_rate_limits (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 window_start timestamptz not null, requests integer not null
);
alter table public.sync_installations enable row level security;
alter table public.sync_days enable row level security;
alter table public.sync_privacy enable row level security;
alter table public.sync_rate_limits enable row level security;
revoke all on public.sync_installations,public.sync_days,public.sync_privacy,public.sync_rate_limits from public,anon,authenticated;

-- Defense in depth: the RPC itself validates; bypassing Next never bypasses
-- scope, ownership, request limits, field allowlists or aggregate consistency.
create function public.sync_validate_day(p jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare k text; b jsonb; previous text; totals jsonb; n numeric;
begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>65536 or (select count(*) from jsonb_object_keys(p))<>12
 or not p ?& array['schemaVersion','aggregationVersion','date','revision','activeMs','editCount','linesAdded','linesRemoved','sessionCount','fileCount','languages','projects']
 or p->>'schemaVersion'<>'1' or p->'aggregationVersion'<>'1'::jsonb or jsonb_typeof(p->'schemaVersion')<>'string'
 or jsonb_typeof(p->'date')<>'string' or p->>'date' !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
 or to_char((p->>'date')::date,'YYYY-MM-DD')<>p->>'date' then return false; end if;
 foreach k in array array['revision','activeMs','editCount','linesAdded','linesRemoved','sessionCount','fileCount'] loop
  if jsonb_typeof(p->k)<>'number' then return false; end if;
  n := (p->>k)::numeric;
  if n<>trunc(n) or n<0 or n>(case when k='revision' then 1000000000000 when k='activeMs' then 604800000 else 1000000000 end) or (k='revision' and n=0) then return false; end if;
 end loop;
 foreach k in array array['languages','projects'] loop
  if jsonb_typeof(p->k)<>'array' or jsonb_array_length(p->k)>256 then return false; end if;
  previous := '';
  for b in select value from jsonb_array_elements(p->k) loop
   if jsonb_typeof(b)<>'object' or (select count(*) from jsonb_object_keys(b))<>5 or not b ?& array['id','activeMs','editCount','linesAdded','linesRemoved']
    or jsonb_typeof(b->'id')<>'string' or (b->>'id') collate "C" <= previous collate "C" then return false; end if;
   previous := b->>'id';
   if k='projects' and previous !~ '^[a-f0-9]{64}$' then return false; end if;
   if k='languages' and not (previous=any(string_to_array('other plaintext javascript javascriptreact typescript typescriptreact python java c cpp csharp go rust ruby php swift kotlin scala dart elixir erlang clojure haskell lua perl r julia matlab objective-c objective-cpp shellscript powershell bat html css scss less sass yaml json jsonc xml toml markdown mdx sql graphql dockerfile makefile cmake terraform hcl vue svelte astro groovy fsharp ocaml nim zig solidity proto diff git-commit git-rebase ignore ini properties csv latex tex bibtex assembly verilog vhdl vb razor handlebars pug coffeescript restructuredtext',' '))) then return false; end if;
   if exists(select 1 from jsonb_each(b) x where x.key<>'id' and (jsonb_typeof(x.value)<>'number' or (x.value::text)::numeric<0 or (x.value::text)::numeric>1000000000 or (x.value::text)::numeric<>trunc((x.value::text)::numeric))) then return false; end if;
  end loop;
  select jsonb_build_object('activeMs',coalesce(sum((value->>'activeMs')::bigint),0),'editCount',coalesce(sum((value->>'editCount')::bigint),0),
   'linesAdded',coalesce(sum((value->>'linesAdded')::bigint),0),'linesRemoved',coalesce(sum((value->>'linesRemoved')::bigint),0)) into totals from jsonb_array_elements(p->k);
  if totals<>jsonb_build_object('activeMs',p->'activeMs','editCount',p->'editCount','linesAdded',p->'linesAdded','linesRemoved',p->'linesRemoved') then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create function public.sync_put_day(p_access_token text,p_installation_id uuid,p_date date,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.extension_connections; previous public.sync_days; requests integer;
begin
 if p_access_token is null or p_access_token !~ '^[a-f0-9]{64}$' then raise exception 'unauthorized' using errcode='28000'; end if;
 select con.* into c from public.extension_access_tokens a join public.extension_connections con on con.id=a.connection_id
 where a.token_hash=encode(extensions.digest(p_access_token,'sha256'),'hex') and a.expires_at>now() and con.expires_at>now();
 if not found then raise exception 'unauthorized' using errcode='28000'; end if;
 if c.scope<>'stats:write' then raise exception 'insufficient_scope' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.user_id::text,1));
 insert into public.sync_rate_limits(user_id,window_start,requests) values(c.user_id,now(),1)
 on conflict(user_id) do update set window_start=case when sync_rate_limits.window_start<now()-interval '1 minute' then now() else sync_rate_limits.window_start end,
 requests=case when sync_rate_limits.window_start<now()-interval '1 minute' then 1 else least(sync_rate_limits.requests+1,61) end returning sync_rate_limits.requests into requests;
 -- Return errors after rate accounting so failed PUTs also consume quota.
 if requests>60 then return jsonb_build_object('error','rate_limited'); end if;
 if p_installation_id is null or p_installation_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 or p_date is null or p_date>current_date+1 or p_payload is null or not public.sync_validate_day(p_payload) or p_payload->>'date'<>p_date::text then return jsonb_build_object('error','invalid_request'); end if;
 if not exists(select 1 from public.sync_installations where user_id=c.user_id and installation_id=p_installation_id)
 and (select count(*) from public.sync_installations where user_id=c.user_id)>=32 then return jsonb_build_object('error','installation_limit'); end if;
 select * into previous from public.sync_days where user_id=c.user_id and installation_id=p_installation_id and date=p_date;
 if found then
  if (p_payload->>'revision')::bigint<previous.revision then return jsonb_build_object('error','stale_revision','revision',previous.revision); end if;
  if (p_payload->>'revision')::bigint=previous.revision then
   if p_payload<>previous.payload then return jsonb_build_object('error','revision_conflict','revision',previous.revision); end if;
   return jsonb_build_object('date',p_date,'installationId',p_installation_id,'revision',previous.revision,'unchanged',true);
  end if;
 end if;
 insert into public.sync_installations(user_id,installation_id) values(c.user_id,p_installation_id)
 on conflict(user_id,installation_id) do update set last_synced_at=now();
 insert into public.sync_days(user_id,installation_id,date,revision,payload) values(c.user_id,p_installation_id,p_date,(p_payload->>'revision')::bigint,p_payload)
 on conflict(user_id,installation_id,date) do update set revision=excluded.revision,payload=excluded.payload,updated_at=now();
 return jsonb_build_object('date',p_date,'installationId',p_installation_id,'revision',(p_payload->>'revision')::bigint,'unchanged',false);
end $$;

-- One reusable reducer for private summaries and explicitly published profiles.
-- It is NEVER directly executable by browser/extension roles.
create function public.sync_aggregate(p_user uuid,p_from date,p_to date)
returns jsonb language sql stable security definer set search_path='' as $$
 with days as (select * from public.sync_days where user_id=p_user and date>=p_from and date<=p_to),
 languages as (select b->>'id' id,sum((b->>'activeMs')::bigint) active_ms,sum((b->>'editCount')::bigint) edits,
 sum((b->>'linesAdded')::bigint) added,sum((b->>'linesRemoved')::bigint) removed from days,jsonb_array_elements(payload->'languages') b group by b->>'id'),
 projects as (select installation_id,b->>'id' id,sum((b->>'activeMs')::bigint) active_ms,sum((b->>'editCount')::bigint) edits,
 sum((b->>'linesAdded')::bigint) added,sum((b->>'linesRemoved')::bigint) removed from days,jsonb_array_elements(payload->'projects') b group by installation_id,b->>'id'),
 active as(select distinct date from days where (payload->>'editCount')::bigint>0 or (payload->>'activeMs')::bigint>0)
 select jsonb_build_object('schemaVersion','1','from',p_from,'to',p_to,
 'activeMs',coalesce(sum((payload->>'activeMs')::bigint),0),'editCount',coalesce(sum((payload->>'editCount')::bigint),0),
 'linesAdded',coalesce(sum((payload->>'linesAdded')::bigint),0),'linesRemoved',coalesce(sum((payload->>'linesRemoved')::bigint),0),
 'sessionDays',coalesce(sum((payload->>'sessionCount')::bigint),0),'fileDays',coalesce(sum((payload->>'fileCount')::bigint),0),
 'projectCount',(select count(*) from projects),'activeDays',(select count(*) from active),'recordCount',count(*),'updatedAt',max(updated_at),
 'activeDates',coalesce((select jsonb_agg(date order by date) from active),'[]'::jsonb),
 'languages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'activeMs',active_ms,'editCount',edits,'linesAdded',added,'linesRemoved',removed) order by active_ms desc,edits desc,id) from languages),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('installationId',installation_id,'id',id,'activeMs',active_ms,'editCount',edits,'linesAdded',added,'linesRemoved',removed) order by active_ms desc,installation_id,id) from projects),'[]'::jsonb)) from days;
$$;
create function public.sync_private_summary(p_period text default '30',p_to date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 if p_period not in('7','30','90','lifetime') or p_period is null or p_to is null or p_to<date '2000-01-01' or p_to>current_date+1 then raise exception 'invalid_request' using errcode='22023'; end if;
 return public.sync_aggregate(auth.uid(),case when p_period='lifetime' then date '2000-01-01' else p_to-(p_period::integer-1) end,p_to);
end $$;
create function public.sync_public_profile(p_username text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare privacy public.sync_privacy; result jsonb;
begin
 select s.* into privacy from public.sync_privacy s join public.profiles p on p.user_id=s.user_id where p.username=p_username and s.publish_profile;
 if not found then return null; end if;
 result := public.sync_aggregate(privacy.user_id,date '2000-01-01',current_date+1);
 -- No project aliases, individual dates, windows or session/file day totals are
 -- implicitly public. Explicit public allowlist, never subtract sensitive fields.
 return jsonb_build_object('activeMs',result->'activeMs','editCount',result->'editCount','linesAdded',result->'linesAdded','linesRemoved',result->'linesRemoved',
 'fileDays',result->'fileDays','projectCount',result->'projectCount','recordCount',result->'recordCount','updatedAt',result->'updatedAt',
 'languages',case when privacy.publish_languages then result->'languages' else '[]'::jsonb end);
end $$;
create function public.sync_get_privacy()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 return coalesce((select jsonb_build_object('publishProfile',publish_profile,'publishLanguages',publish_languages) from public.sync_privacy where user_id=auth.uid()),'{"publishProfile":false,"publishLanguages":false}'::jsonb);
end $$;
create function public.sync_set_privacy(p_publish_profile boolean,p_publish_languages boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 insert into public.sync_privacy(user_id,publish_profile,publish_languages) values(auth.uid(),p_publish_profile,p_publish_languages)
 on conflict(user_id) do update set publish_profile=excluded.publish_profile,publish_languages=excluded.publish_languages,updated_at=now();
end $$;
revoke all on function public.sync_validate_day(jsonb),public.sync_put_day(text,uuid,date,jsonb),public.sync_aggregate(uuid,date,date),public.sync_private_summary(text,date),public.sync_public_profile(text),public.sync_get_privacy(),public.sync_set_privacy(boolean,boolean) from public,anon,authenticated;
grant execute on function public.sync_put_day(text,uuid,date,jsonb),public.sync_public_profile(text) to anon,authenticated;
grant execute on function public.sync_private_summary(text,date),public.sync_get_privacy(),public.sync_set_privacy(boolean,boolean) to authenticated;
commit;
