begin;
-- Additive Phase 9B. No day/profile backfill, table grants, or RLS changes.
-- Existing consents and publications remain v1; a client cannot upgrade itself.
alter table public.extension_auth_codes
 add column stats_schema_version smallint not null default 1 check (stats_schema_version in (1,2)),
 add column stats_consent_at timestamptz,
 add constraint extension_auth_codes_rich_consent check (stats_schema_version=1 or (scope='stats:write' and stats_consent_at is not null));
alter table public.extension_connections
 add column stats_schema_version smallint not null default 1 check (stats_schema_version in (1,2)),
 add column stats_consent_at timestamptz,
 add constraint extension_connections_rich_consent check (stats_schema_version=1 or (scope='stats:write' and stats_consent_at is not null));
alter table public.sync_privacy
 add column publication_version smallint not null default 1 check (publication_version in (1,2)),
 add column published_metrics jsonb not null default '[]'::jsonb,
 add column publish_schedule boolean not null default false;

-- Small private predicates keep the independent SQL validator auditable.
create function public.sync_v2_object(p jsonb, keys text[]) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and p ?& keys and p-keys='{}'::jsonb,false);
$$;
create function public.sync_v2_count(p jsonb, maximum numeric) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 return coalesce(jsonb_typeof(p)='number' and p::text::numeric between 0 and maximum and p::text::numeric=trunc(p::text::numeric),false);
exception when others then return false;
end $$;
create function public.sync_v2_date(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 return coalesce(jsonb_typeof(p)='string' and p#>>'{}' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
   and to_char((p#>>'{}')::date,'YYYY-MM-DD')=p#>>'{}',false);
exception when others then return false;
end $$;
create function public.sync_validate_day_v2(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare
 counters text[] := array['activeMs','editCount','linesAdded','linesRemoved'];
 k text; kind text; b jsonb; o jsonb; d jsonb; h jsonb; c jsonb; previous text; total numeric; n numeric;
 bounds numeric[] := array[1,60000,300000,900000,1800000,3600000,7200000,14400000];
 i integer; first_bin integer := -1; last_bin integer := -1; min_bin integer:=8; max_bin integer:=8;
 lo numeric; hi numeric; minimum numeric:=0; maximum numeric:=0; min_ms numeric; max_ms numeric; samples numeric;
begin
 if p is null or not public.sync_v2_object(p,array['schemaVersion','aggregationVersion','date','revision','activeMs','editCount','linesAdded','linesRemoved',
 'sessionDays','sessionStarts','incompleteSessionStarts','fileCount','languageCount','projectCount','languages','projects','projectOverflow','sessionDurations','hourlyUtc','coverage'])
 -- All accepted strings are ASCII identifiers/literals without whitespace. Strip
 -- only JSONB structural separator spaces to match the compact wire byte bound.
 or octet_length(regexp_replace(p::text,'([,:]) ','\1','g'))>65536
 or p->'schemaVersion' is distinct from '"2"'::jsonb or p->'aggregationVersion' is distinct from '1'::jsonb
 or not public.sync_v2_date(p->'date') then return false; end if;
 if not public.sync_v2_count(p->'revision',1000000000000) or p->'revision'='0'::jsonb then return false; end if;
 foreach k in array counters || array['sessionDays','sessionStarts','incompleteSessionStarts','fileCount','languageCount','projectCount'] loop
  if not public.sync_v2_count(p->k,case when k='activeMs' then 604800000 else 1000000000 end) then return false; end if;
 end loop;
 o:=p->'projectOverflow';
 if not public.sync_v2_object(o,counters || array['projectCount']) or not public.sync_v2_count(o->'projectCount',1000000000) then return false; end if;
 foreach k in array counters loop
  if not public.sync_v2_count(o->k,case when k='activeMs' then 604800000 else 1000000000 end)
   or (o->'projectCount'='0'::jsonb and o->k<>'0'::jsonb) then return false; end if;
 end loop;
 foreach kind in array array['languages','projects'] loop
  if jsonb_typeof(p->kind) is distinct from 'array' or jsonb_array_length(p->kind)>128 then return false; end if;
  previous:='';
  for b in select value from jsonb_array_elements(p->kind) loop
   if not public.sync_v2_object(b,counters || array['id']) or jsonb_typeof(b->'id') is distinct from 'string'
     or (b->>'id') collate "C" <= previous collate "C" then return false; end if;
   previous:=b->>'id';
   if kind='projects' and previous !~ '^[a-f0-9]{64}$' then return false; end if;
   if kind='languages' and not (previous=any(string_to_array('other plaintext javascript javascriptreact typescript typescriptreact python java c cpp csharp go rust ruby php swift kotlin scala dart elixir erlang clojure haskell lua perl r julia matlab objective-c objective-cpp shellscript powershell bat html css scss less sass json jsonc yaml xml toml markdown mdx sql graphql dockerfile makefile cmake terraform hcl vue svelte astro groovy fsharp ocaml nim zig solidity proto diff git-commit git-rebase ignore ini properties csv latex tex bibtex assembly verilog vhdl vb razor handlebars pug coffeescript restructuredtext',' '))) then return false; end if;
   foreach k in array counters loop
    if not public.sync_v2_count(b->k,case when k='activeMs' then 604800000 else 1000000000 end) then return false; end if;
   end loop;
  end loop;
  foreach k in array counters loop
   select coalesce(sum((value->>k)::numeric),0) into total from jsonb_array_elements(p->kind);
   if kind='projects' then total:=total+(o->>k)::numeric; end if;
   if total<>(p->>k)::numeric then return false; end if;
  end loop;
 end loop;
 if (p->>'languageCount')::numeric<>jsonb_array_length(p->'languages')
 or (p->>'projectCount')::numeric<>jsonb_array_length(p->'projects')+(o->>'projectCount')::numeric
 or ((o->>'projectCount')::numeric>0 and jsonb_array_length(p->'projects')<>128)
 or (p->>'fileCount')::numeric<(p->>'projectCount')::numeric then return false; end if;
 if p->'sessionDays'='0'::jsonb then
  foreach k in array counters || array['fileCount','languageCount','projectCount'] loop
   if p->k<>'0'::jsonb then return false; end if;
  end loop;
 elsif p->'fileCount'='0'::jsonb or p->'languageCount'='0'::jsonb or p->'projectCount'='0'::jsonb then return false; end if;
 d:=p->'sessionDurations';
 if not public.sync_v2_object(d,counters || array['count','minActiveMs','maxActiveMs','histogram'])
 or not public.sync_v2_count(d->'count',1000000000) or jsonb_typeof(d->'histogram') is distinct from 'array'
 or jsonb_array_length(d->'histogram')<>9 then return false; end if;
 foreach k in array counters loop
  if not public.sync_v2_count(d->k,case when k='activeMs' then 1000000000000 else 1000000000 end) then return false; end if;
 end loop;
 total:=0; samples:=(d->>'count')::numeric;
 for i in 0..8 loop
  b:=d->'histogram'->i;
  if not public.sync_v2_count(b,1000000000) then return false; end if;
  n:=b::text::numeric; total:=total+n;
  if n>0 then if first_bin=-1 then first_bin:=i; end if; last_bin:=i; end if;
 end loop;
 if total<>samples or (p->>'sessionStarts')::numeric<>samples+(p->>'incompleteSessionStarts')::numeric then return false; end if;
 if samples=0 then
  if d->'minActiveMs'<>'null'::jsonb or d->'maxActiveMs'<>'null'::jsonb then return false; end if;
  foreach k in array counters loop if d->k<>'0'::jsonb then return false; end if; end loop;
 else
  if not public.sync_v2_count(d->'minActiveMs',1000000000000) or not public.sync_v2_count(d->'maxActiveMs',1000000000000) then return false; end if;
  min_ms:=(d->>'minActiveMs')::numeric; max_ms:=(d->>'maxActiveMs')::numeric; total:=(d->>'activeMs')::numeric;
  if min_ms>max_ms or max_ms>total or min_ms*(samples-1)+max_ms>total or max_ms*(samples-1)+min_ms<total then return false; end if;
  for i in reverse 7..0 loop
   if min_ms<bounds[i+1] then min_bin:=i; end if;
   if max_ms<bounds[i+1] then max_bin:=i; end if;
  end loop;
  if min_bin<>first_bin or max_bin<>last_bin then return false; end if;
  for i in 0..8 loop
   n:=(d->'histogram'->>i)::numeric;
   if n=0 then continue; end if;
   lo:=greatest(case when i=0 then 0 else bounds[i] end,min_ms);
   hi:=least(case when i=8 then max_ms else bounds[i+1]-1 end,max_ms);
   if lo>hi then return false; end if;
   minimum:=minimum+n*lo; maximum:=maximum+n*hi;
  end loop;
  minimum:=minimum+max_ms-greatest(case when last_bin=0 then 0 else bounds[last_bin] end,min_ms);
  maximum:=maximum-least(case when first_bin=8 then max_ms else bounds[first_bin+1]-1 end,max_ms)+min_ms;
  if total<minimum or total>maximum then return false; end if;
 end if;
 c:=p->'coverage';
 if not public.sync_v2_object(c,array['source','dateBasis','firstObservedDate','lastObservedDate','uploadFromDate','historyCompleteness','partial'])
 or c->'source' is distinct from '"sessions-v1"'::jsonb or c->'dateBasis' is distinct from '"collector-local"'::jsonb
 or c->'historyCompleteness' is distinct from '"unknown"'::jsonb or c->'partial' is distinct from 'true'::jsonb
 or not public.sync_v2_date(c->'uploadFromDate') or c->>'uploadFromDate'>p->>'date' then return false; end if;
 if c->'firstObservedDate'='null'::jsonb or c->'lastObservedDate'='null'::jsonb then
  if c->'firstObservedDate'<>'null'::jsonb or c->'lastObservedDate'<>'null'::jsonb then return false; end if;
 elsif not public.sync_v2_date(c->'firstObservedDate') or not public.sync_v2_date(c->'lastObservedDate')
 or c->>'firstObservedDate'>c->>'lastObservedDate' or c->>'lastObservedDate'>p->>'date' then return false; end if;
 if (p->>'sessionDays')::numeric+(p->>'sessionStarts')::numeric>0 and c->'lastObservedDate' is distinct from p->'date' then return false; end if;
 h:=p->'hourlyUtc';
 if h<>'null'::jsonb then
  if not public.sync_v2_object(h,array['source','dateBasis','activeMsByHour','editCountByHour','linesAddedByHour','linesRemovedByHour','coverage'])
   or h->'source' is distinct from '"telemetry-v2"'::jsonb or h->'dateBasis' is distinct from '"UTC"'::jsonb then return false; end if;
  foreach k in array counters loop
   b:=h->(k||'ByHour');
   if jsonb_typeof(b) is distinct from 'array' or jsonb_array_length(b)<>24 then return false; end if;
   total:=0;
   for i in 0..23 loop
    if not public.sync_v2_count(b->i,case when k='activeMs' then 604800000 else 1000000000 end) then return false; end if;
    total:=total+(b->>i)::numeric;
   end loop;
   if total>(case when k='activeMs' then 604800000 else 1000000000 end) then return false; end if;
  end loop;
  c:=h->'coverage';
  if not public.sync_v2_object(c,array['firstObservedDate','lastObservedDate','partial','frozen','lateInputIgnored'])
   or c->'firstObservedDate' is distinct from p->'date' or c->'lastObservedDate' is distinct from p->'date'
   or c->'partial' is distinct from 'true'::jsonb or jsonb_typeof(c->'frozen') is distinct from 'boolean'
   or jsonb_typeof(c->'lateInputIgnored') is distinct from 'boolean'
   or (c->'lateInputIgnored'='true'::jsonb and c->'frozen'<>'true'::jsonb) then return false; end if;
 end if;
 return true;
exception when others then return false;
end $$;

create function public.extension_authorize_stats_v2(p_challenge text,p_redirect_uri text)
returns text language plpgsql security definer set search_path='' as $$
declare code text;
begin
 code:=public.extension_authorize_stats(p_challenge,p_redirect_uri);
 update public.extension_auth_codes set stats_schema_version=2,stats_consent_at=now()
 where code_hash=encode(extensions.digest(code,'sha256'),'hex');
 return code;
end $$;

create or replace function public.extension_exchange(p_code text, p_verifier text, p_redirect_uri text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_grant public.extension_auth_codes; v_connection public.extension_connections;
  v_refresh text; v_access text; v_profile public.profiles;
begin
  if p_code is null or p_code !~ '^[a-f0-9]{64}$' or p_verifier is null or p_verifier !~ '^[A-Za-z0-9._~-]{43,128}$' then
    raise exception 'invalid_grant' using errcode = '28000';
  end if;
  -- Serialize exchange with cloud erasure BEFORE consuming the code. A code
  -- read before erasure must still exist after acquiring the account lock.
  select * into v_grant from public.extension_auth_codes where code_hash=encode(extensions.digest(p_code,'sha256'),'hex');
  if not found then raise exception 'invalid_grant' using errcode='28000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_grant.user_id::text,0));
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
  insert into public.extension_connections(user_id, refresh_hash, scope, stats_schema_version, stats_consent_at)
    values(v_grant.user_id, encode(extensions.digest(v_refresh, 'sha256'), 'hex'), v_grant.scope, v_grant.stats_schema_version, v_grant.stats_consent_at) returning * into v_connection;
  insert into public.extension_access_tokens(token_hash, connection_id)
    values(encode(extensions.digest(v_access, 'sha256'), 'hex'), v_connection.id);
  return (case when v_connection.scope = 'stats:write' then jsonb_build_object('syncGrant', v_connection.id) else '{}'::jsonb end) || jsonb_build_object('accessToken', v_access, 'refreshToken', v_refresh,
    'expiresAt', now() + interval '15 minutes', 'refreshExpiresAt', v_connection.expires_at,
    'account', jsonb_build_object('userId', v_profile.user_id, 'username', v_profile.username, 'displayName', v_profile.display_name));
end $$;

create or replace function public.sync_put_day(p_access_token text,p_installation_id uuid,p_date date,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.extension_connections; previous public.sync_days; requests integer;
begin
 if p_access_token is null or p_access_token !~ '^[a-f0-9]{64}$' then raise exception 'unauthorized' using errcode='28000'; end if;
 select con.* into c from public.extension_access_tokens a join public.extension_connections con on con.id=a.connection_id
 where a.token_hash=encode(extensions.digest(p_access_token,'sha256'),'hex') and a.expires_at>now() and con.expires_at>now();
 if not found then raise exception 'unauthorized' using errcode='28000'; end if;
 if c.scope<>'stats:write' then raise exception 'insufficient_scope' using errcode='42501'; end if;
 if p_payload->>'schemaVersion'='2' and c.stats_schema_version<>2 then raise exception 'insufficient_scope' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.user_id::text,1));
 -- Recheck after waiting: an erase/revocation may have invalidated this token.
 if not exists(select 1 from public.extension_access_tokens a join public.extension_connections con on con.id=a.connection_id
  where con.id=c.id and a.token_hash=encode(extensions.digest(p_access_token,'sha256'),'hex') and a.expires_at>now() and con.expires_at>now())
 then raise exception 'unauthorized' using errcode='28000'; end if;
 insert into public.sync_rate_limits(user_id,window_start,requests) values(c.user_id,now(),1)
 on conflict(user_id) do update set window_start=case when sync_rate_limits.window_start<now()-interval '1 minute' then now() else sync_rate_limits.window_start end,
 requests=case when sync_rate_limits.window_start<now()-interval '1 minute' then 1 else least(sync_rate_limits.requests+1,61) end returning sync_rate_limits.requests into requests;
 -- Return errors after rate accounting so failed PUTs also consume quota.
 if requests>60 then return jsonb_build_object('error','rate_limited'); end if;
 if p_installation_id is null or p_installation_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 or p_date is null or p_date>current_date+1 or p_payload is null or (case p_payload->>'schemaVersion' when '1' then public.sync_validate_day(p_payload) when '2' then public.sync_validate_day_v2(p_payload) else false end) is distinct from true or p_payload->>'date'<>p_date::text then return jsonb_build_object('error','invalid_request'); end if;
 if not exists(select 1 from public.sync_installations where user_id=c.user_id and installation_id=p_installation_id)
 and (select count(*) from public.sync_installations where user_id=c.user_id)>=32 then return jsonb_build_object('error','installation_limit'); end if;
 select * into previous from public.sync_days where user_id=c.user_id and installation_id=p_installation_id and date=p_date;
 if found then
  if previous.payload->>'schemaVersion'='2' and p_payload->>'schemaVersion'='1' then return jsonb_build_object('error','version_downgrade','revision',previous.revision); end if;
  if (p_payload->>'revision')::bigint<previous.revision then return jsonb_build_object('error','stale_revision','revision',previous.revision); end if;
  if (p_payload->>'revision')::bigint=previous.revision then
   if p_payload<>previous.payload then return jsonb_build_object('error','revision_conflict','revision',previous.revision); end if;
   return (case when p_payload->>'schemaVersion'='2' then jsonb_build_object('schemaVersion','2') else '{}'::jsonb end) || jsonb_build_object('date',p_date,'installationId',p_installation_id,'revision',previous.revision,'unchanged',true);
  end if;
 end if;
 insert into public.sync_installations(user_id,installation_id) values(c.user_id,p_installation_id)
 on conflict(user_id,installation_id) do update set last_synced_at=now();
 insert into public.sync_days(user_id,installation_id,date,revision,payload) values(c.user_id,p_installation_id,p_date,(p_payload->>'revision')::bigint,p_payload)
 on conflict(user_id,installation_id,date) do update set revision=excluded.revision,payload=excluded.payload,updated_at=now();
 return (case when p_payload->>'schemaVersion'='2' then jsonb_build_object('schemaVersion','2') else '{}'::jsonb end) || jsonb_build_object('date',p_date,'installationId',p_installation_id,'revision',(p_payload->>'revision')::bigint,'unchanged',false);
end $$;

create or replace function public.sync_aggregate(p_user uuid,p_from date,p_to date)
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
 'sessionDays',coalesce(sum((case when payload->>'schemaVersion'='1' then payload->>'sessionCount' else payload->>'sessionDays' end)::bigint),0),'fileDays',coalesce(sum((payload->>'fileCount')::bigint),0),
 'projectCount',case when coalesce(sum((payload#>>'{projectOverflow,projectCount}')::bigint),0)>0 then null else (select count(*) from projects) end,'activeDays',(select count(*) from active),'recordCount',count(*),'updatedAt',max(updated_at),
 'activeDates',coalesce((select jsonb_agg(date order by date) from active),'[]'::jsonb),
 'languages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'activeMs',active_ms,'editCount',edits,'linesAdded',added,'linesRemoved',removed) order by active_ms desc,edits desc,id) from languages),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('installationId',installation_id,'id',id,'activeMs',active_ms,'editCount',edits,'linesAdded',added,'linesRemoved',removed) order by active_ms desc,installation_id,id) from projects),'[]'::jsonb)) from days;
$$;
create or replace function public.sync_public_profile(p_username text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare privacy public.sync_privacy; result jsonb;
begin
 select s.* into privacy from public.sync_privacy s join public.profiles p on p.user_id=s.user_id where p.username=p_username and s.publish_profile and s.publication_version=1;
 if not found then return null; end if;
 result := public.sync_aggregate(privacy.user_id,date '2000-01-01',current_date+1);
 -- No project aliases, individual dates, windows or session/file day totals are
 -- implicitly public. Explicit public allowlist, never subtract sensitive fields.
 return jsonb_build_object('activeMs',result->'activeMs','editCount',result->'editCount','linesAdded',result->'linesAdded','linesRemoved',result->'linesRemoved',
 'fileDays',result->'fileDays','projectCount',result->'projectCount','recordCount',result->'recordCount','updatedAt',result->'updatedAt',
 'languages',case when privacy.publish_languages then result->'languages' else '[]'::jsonb end);
end $$;
create or replace function public.sync_set_privacy(p_publish_profile boolean,p_publish_languages boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,2));
 if exists(select 1 from public.sync_privacy where user_id=auth.uid() and publication_version=2) then raise exception 'publication_version_conflict' using errcode='22023'; end if;
 insert into public.sync_privacy(user_id,publish_profile,publish_languages) values(auth.uid(),p_publish_profile,p_publish_languages)
 on conflict(user_id) do update set publish_profile=excluded.publish_profile,publish_languages=excluded.publish_languages,updated_at=now();
end $$;

create function public.sync_capabilities(p_access_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.extension_connections;
begin
 if p_access_token is null or p_access_token !~ '^[a-f0-9]{64}$' then raise exception 'unauthorized' using errcode='28000'; end if;
 select con.* into c from public.extension_access_tokens a join public.extension_connections con on con.id=a.connection_id
 where a.token_hash=encode(extensions.digest(p_access_token,'sha256'),'hex') and a.expires_at>now() and con.expires_at>now();
 if not found then raise exception 'unauthorized' using errcode='28000'; end if;
 if c.scope<>'stats:write' then raise exception 'insufficient_scope' using errcode='42501'; end if;
 return jsonb_build_object('schemaVersion','1','dailyVersions',case when c.stats_schema_version=2 then '["1","2"]'::jsonb else '["1"]'::jsonb end);
end $$;

-- Fail explicitly if a very large period exceeds JavaScript's exact integer
-- range. The wire day's limits are not a bound on an all-installation sum.
create function public.sync_json_numbers_safe(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare child jsonb;
begin
 if jsonb_typeof(p)='number' then return abs(p::text::numeric)<=9007199254740991; end if;
 if jsonb_typeof(p)='object' then
  for child in select value from jsonb_each(p) loop if not public.sync_json_numbers_safe(child) then return false; end if; end loop;
 elsif jsonb_typeof(p)='array' then
  for child in select value from jsonb_array_elements(p) loop if not public.sync_json_numbers_safe(child) then return false; end if; end loop;
 end if;
 return true;
end $$;
create function public.sync_checked_result(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 if not public.sync_json_numbers_safe(p) then raise exception 'aggregate_limit' using errcode='54000'; end if;
 return p;
end $$;

-- Unknown history is never zero-filled. Summaries are partial observations,
-- including when every stored row is v2. Independent devices can overlap.
create function public.sync_aggregate_v2(p_user uuid,p_from date,p_to date) returns jsonb
language sql stable security definer set search_path='' as $$
 with days as materialized (select * from public.sync_days where user_id=p_user and date between p_from and p_to),
 rich as (select * from days where payload->>'schemaVersion'='2'),
 cohorts as (select payload->'sessionDurations' d from rich),
 languages as (select b->>'id' id,sum((b->>'activeMs')::numeric) active_ms,sum((b->>'editCount')::numeric) edits,
 sum((b->>'linesAdded')::numeric) added,sum((b->>'linesRemoved')::numeric) removed from days,jsonb_array_elements(payload->'languages') b group by b->>'id'),
 projects as (select installation_id,b->>'id' id,sum((b->>'activeMs')::numeric) active_ms,sum((b->>'editCount')::numeric) edits,
 sum((b->>'linesAdded')::numeric) added,sum((b->>'linesRemoved')::numeric) removed from days,jsonb_array_elements(payload->'projects') b group by installation_id,b->>'id'),
 ranked_projects as (select *,row_number() over(order by active_ms desc,edits desc,added desc,removed desc,installation_id,id collate "C") rank from projects),
 active as (select distinct date from days where (payload->>'activeMs')::numeric>0 or (payload->>'editCount')::numeric>0),
 bins as (select i,coalesce(sum((d->'histogram'->>i)::numeric),0) n from generate_series(0,8) i left join cohorts on true group by i),
 hourly as (select * from rich where payload->'hourlyUtc'<>'null'::jsonb),
 hours as (select i,coalesce(sum((payload#>>array['hourlyUtc','activeMsByHour',i::text])::numeric),0) active_ms,
 coalesce(sum((payload#>>array['hourlyUtc','editCountByHour',i::text])::numeric),0) edits,
 coalesce(sum((payload#>>array['hourlyUtc','linesAddedByHour',i::text])::numeric),0) added,
 coalesce(sum((payload#>>array['hourlyUtc','linesRemovedByHour',i::text])::numeric),0) removed
 from generate_series(0,23) i left join hourly on true group by i)
 select public.sync_checked_result(jsonb_build_object('schemaVersion','2','from',p_from,'to',p_to,
 'activeMs',coalesce(sum((payload->>'activeMs')::numeric),0),'editCount',coalesce(sum((payload->>'editCount')::numeric),0),
 'linesAdded',coalesce(sum((payload->>'linesAdded')::numeric),0),'linesRemoved',coalesce(sum((payload->>'linesRemoved')::numeric),0),
 'fileDays',coalesce(sum((payload->>'fileCount')::numeric),0),
 'sessionDays',coalesce(sum((case when payload->>'schemaVersion'='1' then payload->>'sessionCount' else payload->>'sessionDays' end)::numeric),0),
 'sessionStarts',case when count(*) filter(where payload->>'schemaVersion'='2')>0 then sum((payload->>'sessionStarts')::numeric) end,
 'incompleteSessionStarts',sum((payload->>'incompleteSessionStarts')::numeric),
 'activeDays',(select count(*) from active),'languageCount',(select count(*) from languages),
 'projectKnownCount',(select count(*) from projects),
 'projectIdentityComplete',coalesce(sum((payload#>>'{projectOverflow,projectCount}')::numeric),0)=0,
 'projectOverflow',jsonb_build_object('projectDays',coalesce(sum((payload#>>'{projectOverflow,projectCount}')::numeric),0),
 'activeMs',coalesce(sum((payload#>>'{projectOverflow,activeMs}')::numeric),0),'editCount',coalesce(sum((payload#>>'{projectOverflow,editCount}')::numeric),0),
 'linesAdded',coalesce(sum((payload#>>'{projectOverflow,linesAdded}')::numeric),0),'linesRemoved',coalesce(sum((payload#>>'{projectOverflow,linesRemoved}')::numeric),0)),
 'projectSelectionRemainder',(select jsonb_build_object('knownIdentities',count(*),'activeMs',coalesce(sum(active_ms),0),'editCount',coalesce(sum(edits),0),'linesAdded',coalesce(sum(added),0),'linesRemoved',coalesce(sum(removed),0)) from ranked_projects where rank>128),
 'sessionDurations',case when (select count(*) from rich)>0 then (select jsonb_build_object(
 'count',coalesce(sum((d->>'count')::numeric),0),'activeMs',coalesce(sum((d->>'activeMs')::numeric),0),
 'editCount',coalesce(sum((d->>'editCount')::numeric),0),'linesAdded',coalesce(sum((d->>'linesAdded')::numeric),0),'linesRemoved',coalesce(sum((d->>'linesRemoved')::numeric),0),
 'minActiveMs',min((d->>'minActiveMs')::numeric),'maxActiveMs',max((d->>'maxActiveMs')::numeric),
 'averageActiveMs',sum((d->>'activeMs')::numeric)/nullif(sum((d->>'count')::numeric),0),
 'histogram',(select jsonb_agg(n order by i) from bins)) from cohorts) end,
 'languages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'activeMs',active_ms,'editCount',edits,'linesAdded',added,'linesRemoved',removed) order by active_ms desc,edits desc,id collate "C") from languages),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('installationId',installation_id,'id',id,'activeMs',active_ms,'editCount',edits,'linesAdded',added,'linesRemoved',removed) order by rank) from ranked_projects where rank<=128),'[]'::jsonb),
 'hourlyUtc',case when (select count(*) from hourly)>0 then jsonb_build_object('source','telemetry-v2','dateBasis','UTC',
 'activeMsByHour',(select jsonb_agg(active_ms order by i) from hours),'editCountByHour',(select jsonb_agg(edits order by i) from hours),
 'linesAddedByHour',(select jsonb_agg(added order by i) from hours),'linesRemovedByHour',(select jsonb_agg(removed order by i) from hours)) end,
 'coverage',jsonb_build_object('source','sessions-v1','dateBasis','collector-local','historyCompleteness','unknown','partial',true,
 'recordCount',count(*),'v1Records',count(*) filter(where payload->>'schemaVersion'='1'),'v2Records',count(*) filter(where payload->>'schemaVersion'='2'),
 'firstUploadedDate',min(date),'lastUploadedDate',max(date),'uploadedDates',count(distinct date),
 'firstObservedDate',min(payload#>>'{coverage,firstObservedDate}'),'lastObservedDate',max(payload#>>'{coverage,lastObservedDate}'),
 'earliestUploadFromDate',min(payload#>>'{coverage,uploadFromDate}'),'latestUploadFromDate',max(payload#>>'{coverage,uploadFromDate}'),
 'hourlyRecords',(select count(*) from hourly),'hourlyDates',(select count(distinct date) from hourly),
 'frozenHourlyRecords',(select count(*) from hourly where payload#>>'{hourlyUtc,coverage,frozen}'='true'),
 'lateInputIgnoredRecords',(select count(*) from hourly where payload#>>'{hourlyUtc,coverage,lateInputIgnored}'='true'))))
 from days;
$$;

create function public.sync_period_from(p_period text,p_to date) returns date
language plpgsql stable set search_path='' as $$
begin
 if p_period is null or p_period not in('7','30','90','lifetime') or p_to is null or p_to<date '2000-01-01' or p_to>least(current_date+1,date '2099-12-31') then raise exception 'invalid_request' using errcode='22023'; end if;
 return case when p_period='lifetime' then date '2000-01-01' else greatest(date '2000-01-01',p_to-(p_period::integer-1)) end;
end $$;
create function public.sync_private_summary_v2(p_period text default '30',p_to date default current_date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 return public.sync_aggregate_v2(auth.uid(),public.sync_period_from(p_period,p_to),p_to);
end $$;

create function public.sync_datasets_v2(p_user uuid,p_from date,p_to date,p_dataset text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; summary jsonb; budget bigint;
begin
 if p_dataset is null or p_dataset not in ('daily','languagesByDay','projectsByDay','sessionStartCohorts','hourlyUtc')
 or p_from is null or p_to is null or p_to-p_from not between 0 and 89 then raise exception 'invalid_request' using errcode='22023'; end if;
 -- Bound expansion before building JSON. Fail explicitly rather than silently
 -- dropping dates, private project identities, or counters.
 select coalesce(sum(case when p_dataset='projectsByDay' then jsonb_array_length(payload->'projects')+1
  when p_dataset='languagesByDay' then jsonb_array_length(payload->'languages') else 1 end),0) into budget
 from public.sync_days where user_id=p_user and date between p_from and p_to;
 if budget>10000 then raise exception 'dataset_limit' using errcode='54000'; end if;
 summary:=public.sync_aggregate_v2(p_user,p_from,p_to);
 if p_dataset in ('daily','sessionStartCohorts','hourlyUtc') then
  select coalesce(jsonb_agg(case p_dataset
   when 'daily' then jsonb_build_object('date',d.date,'activeMs',a->'activeMs','editCount',a->'editCount','linesAdded',a->'linesAdded','linesRemoved',a->'linesRemoved','sessionDays',a->'sessionDays','fileDays',a->'fileDays','coverage',a->'coverage')
   when 'sessionStartCohorts' then jsonb_build_object('date',d.date,'sessionStarts',a->'sessionStarts','incompleteSessionStarts',a->'incompleteSessionStarts','sessionDurations',a->'sessionDurations','coverage',a->'coverage')
   else jsonb_build_object('date',d.date,'hourlyUtc',a->'hourlyUtc','coverage',a->'coverage') end order by d.date),'[]'::jsonb) into rows
  from (select distinct date from public.sync_days where user_id=p_user and date between p_from and p_to) d
  cross join lateral (select public.sync_aggregate_v2(p_user,d.date,d.date) a) s;
 else
  with days as (select * from public.sync_days where user_id=p_user and date between p_from and p_to),
  values as (
   select date,case when p_dataset='projectsByDay' then installation_id end installation_id,b->>'id' id,false overflow,
    (b->>'activeMs')::numeric active_ms,(b->>'editCount')::numeric edits,(b->>'linesAdded')::numeric added,(b->>'linesRemoved')::numeric removed,0::numeric project_days
   from days,jsonb_array_elements(payload->case when p_dataset='projectsByDay' then 'projects' else 'languages' end) b
   union all
   select date,installation_id,null,true,(payload#>>'{projectOverflow,activeMs}')::numeric,(payload#>>'{projectOverflow,editCount}')::numeric,
    (payload#>>'{projectOverflow,linesAdded}')::numeric,(payload#>>'{projectOverflow,linesRemoved}')::numeric,(payload#>>'{projectOverflow,projectCount}')::numeric
   from days where p_dataset='projectsByDay' and (payload#>>'{projectOverflow,projectCount}')::numeric>0
  ), grouped as (select date,installation_id,id,overflow,sum(active_ms) active_ms,sum(edits) edits,sum(added) added,sum(removed) removed,sum(project_days) project_days
    from values group by date,installation_id,id,overflow)
  select coalesce(jsonb_agg(jsonb_build_object('date',date,'id',id,'activeMs',active_ms,'editCount',edits,'linesAdded',added,'linesRemoved',removed)
   || case when p_dataset='projectsByDay' then jsonb_build_object('installationId',installation_id,'overflow',overflow,'overflowProjectDays',project_days) else '{}'::jsonb end
   order by date,installation_id,id collate "C" nulls last),'[]'::jsonb) into rows from grouped;
 end if;
 if octet_length(rows::text)>2097152 then raise exception 'dataset_limit' using errcode='54000'; end if;
 return jsonb_build_object('schemaVersion','2','dataset',p_dataset,'from',p_from,'to',p_to,
 'dateBasis',case when p_dataset='hourlyUtc' then 'UTC' else 'collector-local' end,'rows',rows,'coverage',summary->'coverage');
end $$;
create function public.sync_private_datasets_v2(p_period text,p_to date,p_dataset text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 return public.sync_datasets_v2(auth.uid(),public.sync_period_from(p_period,p_to),p_to,p_dataset);
end $$;

-- Initial public registry is deliberately finite. No project identifiers,
-- coverage dates, installation IDs or raw private rows are ever publishable.
create function public.sync_public_metric_ids() returns text[]
language sql immutable set search_path='' as $$ select array[
 'activity.active_ms','activity.edits','activity.lines_added','activity.lines_removed','activity.net_lines','activity.churn','activity.file_days','activity.active_days',
 'sessions.days','sessions.starts','sessions.completed','sessions.active_ms','sessions.average_ms','sessions.longest_ms','sessions.histogram',
 'languages.activity','languages.count','schedule.daily','schedule.hourly_utc']; $$;
create function public.sync_publication_valid(ids jsonb,schedule boolean) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if ids is null or schedule is null or jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids)>128 then return false; end if;
 return not exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x)<>'string' or not(x#>>'{}'=any(public.sync_public_metric_ids())) or (x#>>'{}' like 'schedule.%' and not schedule))
 and (select count(distinct x) from jsonb_array_elements(ids) x)=jsonb_array_length(ids);
end $$;
alter table public.sync_privacy add constraint sync_privacy_metric_selection check(public.sync_publication_valid(published_metrics,publish_schedule));
create function public.sync_get_privacy_v2() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 return coalesce((select jsonb_build_object('schemaVersion','2','publicationVersion',publication_version,'publishProfile',publish_profile,'publishLanguages',publish_languages,'metricIds',published_metrics,'publishSchedule',publish_schedule)
 from public.sync_privacy where user_id=auth.uid()),'{"schemaVersion":"2","publicationVersion":1,"publishProfile":false,"publishLanguages":false,"metricIds":[],"publishSchedule":false}'::jsonb);
end $$;
create function public.sync_set_privacy_v2(p_publish_profile boolean,p_metric_ids jsonb,p_publish_schedule boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 if p_publish_profile is null or not public.sync_publication_valid(p_metric_ids,p_publish_schedule) then raise exception 'invalid_request' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,2));
 insert into public.sync_privacy(user_id,publish_profile,publication_version,published_metrics,publish_schedule)
 values(auth.uid(),p_publish_profile,2,p_metric_ids,p_publish_schedule)
 on conflict(user_id) do update set publish_profile=excluded.publish_profile,publication_version=2,
 published_metrics=excluded.published_metrics,publish_schedule=excluded.publish_schedule,updated_at=now();
end $$;

create function public.sync_public_profile_v2(p_username text,p_period text default '30',p_to date default current_date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare privacy public.sync_privacy; summary jsonb; metric text; field text; unit text; value jsonb; results jsonb:='[]'; result jsonb; from_date date; quality text; dataset jsonb;
begin
 from_date:=public.sync_period_from(p_period,p_to);
 select s.* into privacy from public.sync_privacy s join public.profiles p on p.user_id=s.user_id
 where p.username=p_username and s.publish_profile and s.publication_version=2;
 if not found then return null; end if;
 summary:=public.sync_aggregate_v2(privacy.user_id,from_date,p_to);
 for metric in select jsonb_array_elements_text(privacy.published_metrics) order by 1 loop
  if not (metric=any(public.sync_public_metric_ids())) then continue; end if;
  if metric like 'schedule.%' and not privacy.publish_schedule then continue; end if;
  unit:='count'; value:=null; dataset:=null;
  quality:=case when (summary#>>'{coverage,recordCount}')::bigint=0 then 'unavailable' else 'partial' end;
  field:=case metric when 'activity.active_ms' then 'activeMs' when 'activity.edits' then 'editCount' when 'activity.lines_added' then 'linesAdded'
    when 'activity.lines_removed' then 'linesRemoved' when 'activity.file_days' then 'fileDays' when 'activity.active_days' then 'activeDays'
    when 'sessions.days' then 'sessionDays' when 'sessions.starts' then 'sessionStarts' when 'languages.count' then 'languageCount' end;
  if field is not null then value:=summary->field; end if;
  if metric in ('schedule.daily','activity.active_ms','sessions.active_ms','sessions.average_ms','sessions.longest_ms') then unit:='milliseconds';
  elsif metric in ('activity.lines_added','activity.lines_removed','activity.net_lines','activity.churn') then unit:='lines'; end if;
  if metric='activity.net_lines' then value:=to_jsonb((summary->>'linesAdded')::numeric-(summary->>'linesRemoved')::numeric); end if;
  if metric='activity.churn' then value:=to_jsonb((summary->>'linesAdded')::numeric+(summary->>'linesRemoved')::numeric); end if;
  if metric like 'sessions.%' and metric<>'sessions.days' then
   if (summary#>>'{coverage,v2Records}')::bigint=0 then quality:='unavailable'; end if;
   if metric='sessions.completed' then value:=summary#>'{sessionDurations,count}'; end if;
   if metric='sessions.active_ms' then value:=summary#>'{sessionDurations,activeMs}'; end if;
   if metric='sessions.average_ms' then value:=summary#>'{sessionDurations,averageActiveMs}'; end if;
   if metric='sessions.longest_ms' then value:=summary#>'{sessionDurations,maxActiveMs}'; end if;
   if metric='sessions.histogram' then dataset:=summary#>'{sessionDurations,histogram}'; end if;
  end if;
  if metric='languages.activity' then dataset:=summary->'languages'; end if;
  if metric='schedule.daily' then
   if p_period='lifetime' then raise exception 'invalid_request' using errcode='22023'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('date',x->'date','activeMs',x->'activeMs','editCount',x->'editCount','linesAdded',x->'linesAdded','linesRemoved',x->'linesRemoved') order by x->>'date'),'[]'::jsonb)
    into dataset from jsonb_array_elements(public.sync_datasets_v2(privacy.user_id,from_date,p_to,'daily')->'rows') x;
  end if;
  if metric='schedule.hourly_utc' then
   dataset:=summary->'hourlyUtc';
   if dataset is null or dataset='null'::jsonb then quality:='unavailable'; end if;
  end if;
  if quality='unavailable' then value:='null'; dataset:=case when metric in ('sessions.histogram','languages.activity','schedule.daily','schedule.hourly_utc') then 'null'::jsonb else null end; end if;
  result:=jsonb_build_object('id',metric,'definitionVersion',1,'unit',unit,'quality',quality,'dateBasis',case when metric='schedule.hourly_utc' then 'UTC' else 'collector-local' end);
  if metric in ('sessions.histogram','languages.activity','schedule.daily','schedule.hourly_utc') then result:=result||jsonb_build_object('dataset',dataset);
  else result:=result||jsonb_build_object('value',value); end if;
  results:=results||jsonb_build_array(result);
 end loop;
 return public.sync_checked_result(jsonb_build_object('schemaVersion','2','metrics',results));
end $$;

-- Explicit owner export is paged by canonical (date, installation) key, never
-- offset-based. Downloaded copies/backups are outside live-database erasure.
create function public.sync_export_v2(p_after_date date default null,p_after_installation uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 if (p_after_date is null)<>(p_after_installation is null) then raise exception 'invalid_request' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('installationId',installation_id,'date',date,'payload',payload) order by date,installation_id),'[]'::jsonb) into rows
 from (select * from public.sync_days where user_id=auth.uid() and (p_after_date is null or (date,installation_id)>(p_after_date,p_after_installation)) order by date,installation_id limit 50) page;
 return jsonb_build_object('schemaVersion','2','rows',rows,'next',case when jsonb_array_length(rows)=50 then jsonb_build_object('date',rows->49->'date','installationId',rows->49->'installationId') else null end);
end $$;
create function public.sync_erase_cloud_data() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='28000'; end if;
 -- Same account lock as exchange, PUT lock, then privacy lock. Revoke upload grants so a retry cannot
 -- silently recreate erased records. Identity-only links and manual data stay.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,1));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,2));
 delete from public.extension_connections where user_id=auth.uid() and scope='stats:write';
 delete from public.extension_auth_codes where user_id=auth.uid() and scope='stats:write';
 delete from public.sync_installations where user_id=auth.uid();
 delete from public.sync_privacy where user_id=auth.uid();
 delete from public.sync_rate_limits where user_id=auth.uid();
end $$;

-- New helpers start with PostgreSQL's PUBLIC default: close every one explicitly.
revoke all on function public.sync_json_numbers_safe(jsonb),public.sync_checked_result(jsonb),public.sync_v2_object(jsonb,text[]),public.sync_v2_count(jsonb,numeric),public.sync_v2_date(jsonb),
 public.sync_validate_day_v2(jsonb),public.sync_aggregate_v2(uuid,date,date),public.sync_period_from(text,date),public.sync_datasets_v2(uuid,date,date,text),
 public.sync_public_metric_ids(),public.sync_publication_valid(jsonb,boolean),public.extension_authorize_stats_v2(text,text),public.sync_capabilities(text),
 public.sync_private_summary_v2(text,date),public.sync_private_datasets_v2(text,date,text),public.sync_get_privacy_v2(),public.sync_set_privacy_v2(boolean,jsonb,boolean),
 public.sync_public_profile_v2(text,text,date),public.sync_export_v2(date,uuid),public.sync_erase_cloud_data() from public,anon,authenticated;
grant execute on function public.extension_authorize_stats_v2(text,text),public.sync_private_summary_v2(text,date),public.sync_private_datasets_v2(text,date,text),
 public.sync_get_privacy_v2(),public.sync_set_privacy_v2(boolean,jsonb,boolean),public.sync_export_v2(date,uuid),public.sync_erase_cloud_data() to authenticated;
grant execute on function public.sync_capabilities(text),public.sync_public_profile_v2(text,text,date) to anon,authenticated;
commit;
