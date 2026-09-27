-- Read-only: run this ENTIRE file before 20260927000000_sync_daily_v2.sql.
-- Inspect actual schema and stored v1 rows; do not rely on migration history.
begin read only;
set local search_path=pg_catalog,public;
do $$ declare name text; role_name text;
begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('extension_auth_codes','extension_connections') and column_name in ('stats_schema_version','stats_consent_at'))
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
  'sync_v2_object','sync_v2_count','sync_v2_date','sync_validate_day_v2','extension_authorize_stats_v2','sync_capabilities','sync_json_numbers_safe','sync_checked_result','sync_aggregate_v2','sync_period_from','sync_private_summary_v2','sync_datasets_v2','sync_private_datasets_v2','sync_public_metric_ids','sync_publication_valid','sync_get_privacy_v2','sync_set_privacy_v2','sync_public_profile_v2','sync_export_v2','sync_erase_cloud_data'])) then
  raise exception 'Sync v2 preflight stopped: v2 objects already exist. Run verify-production.sql; do not replay or skip selected migration statements.';
 end if;
 foreach name in array array['sync_validate_day(jsonb)','sync_put_day(text,uuid,date,jsonb)','sync_private_summary(text,date)','sync_public_profile(text)',
 'extension_authorize_stats(text,text)','extension_exchange(text,text,text)','extension_refresh_stats(text,text)',
 'profile_layout_is_valid(jsonb)','profile_layout_v1_is_valid(jsonb)','update_profile_layout(jsonb)'] loop
  if to_regprocedure('public.'||name) is null then raise exception 'Missing prerequisite: %',name; end if;
 end loop;
 foreach name in array array['extension_auth_codes','extension_connections','extension_access_tokens','extension_refresh_history','sync_installations','sync_days','sync_privacy','sync_rate_limits'] loop
  if not coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.'||name)),false) then raise exception 'Missing private relation/RLS: %',name; end if;
  foreach role_name in array array['anon','authenticated'] loop
   if has_table_privilege(role_name,'public.'||name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Unexpected direct private table access: % %',role_name,name; end if;
  end loop;
 end loop;
 if exists(select 1 from public.sync_days where payload->>'schemaVersion' is distinct from '1' or public.sync_validate_day(payload) is distinct from true
   or payload->>'date' is distinct from date::text or (payload->>'revision')::numeric is distinct from revision) then
  raise exception 'Existing sync rows do not match the canonical v1 contract; inspect without rewriting them.';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='sync_privacy' and column_name in ('publication_version','published_metrics','publish_schedule')) then
  raise exception 'Unexpected partial publication schema; inspect before choosing a repair.';
 end if;
end $$;
select 'Ready: run the entire 20260927000000_sync_daily_v2.sql, then the entire verify-production.sql before enabling the new web routes.' as next_step;
rollback;
