-- Read-only preflight for a project still on the original v1 layout validator.
-- Run the ENTIRE file in the intended hosted project's SQL Editor. On success,
-- run ALL of migrations/20260925000000_profile_visualizations.sql, then ALL of
-- verify-production.sql. This preflight does not apply or repair any migration.
begin read only;
set local search_path = pg_catalog, public;

do $preflight$
declare
  validator oid := to_regprocedure('public.profile_layout_is_valid(jsonb)');
begin
  if to_regprocedure('public.profile_layout_v1_is_valid(jsonb)') is not null then
    raise exception 'Preflight refused: the visualization helper already exists. Run verify-production.sql and inspect migration state instead of replaying the migration.';
  end if;
  -- Fingerprint the whitespace-normalized prosrc of the original validator in
  -- 20260924000000_profile_layout.sql. A compatibility check, not a security hash.
  if not exists (
    select 1 from pg_proc p join pg_language l on l.oid = p.prolang
    where p.oid = validator and l.lanname = 'plpgsql'
      and p.prokind = 'f' and p.prorettype = 'boolean'::regtype
      and not p.proretset and not p.prosecdef and not p.proisstrict
      and p.provolatile = 'i' and p.proargnames = array['p_layout']::text[]
      and p.proconfig = array['search_path=""']::text[]
      and md5(regexp_replace(p.prosrc, '[[:space:]]', '', 'g')) = 'ec77e78fb2a96c366e748c91f3d66c33'
  ) then
    raise exception 'Preflight refused: expected the original v1 validator. Inspect pg_get_functiondef before choosing a migration.';
  end if;
  if not exists (
    select 1 from pg_constraint c join pg_depend d
      on d.classid = 'pg_constraint'::regclass and d.objid = c.oid
    where c.conrelid = 'public.profiles'::regclass
      and c.conname = 'profiles_profile_layout_check'
      and c.contype = 'c' and c.convalidated
      and d.refclassid = 'pg_proc'::regclass and d.refobjid = validator
  ) then
    raise exception 'Preflight refused: the validated profile layout CHECK must depend on the original validator.';
  end if;
  if not exists (
    select 1 from pg_proc p where p.oid = to_regprocedure('public.update_profile_layout(jsonb)')
      and not p.prosecdef and p.prorettype = 'void'::regtype
  ) or not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) then
    raise exception 'Preflight refused: expected the invoker layout RPC and profile RLS.';
  end if;
  if exists (
    select 1 from public.profiles where public.profile_layout_is_valid(profile_layout) is distinct from true
  ) then
    raise exception 'Preflight refused: existing profiles do not satisfy the original v1 layout contract.';
  end if;
end;
$preflight$;

select 'Ready to apply the entire 20260925000000_profile_visualizations.sql file, then rerun verify-production.sql.' as next_step;
rollback;
