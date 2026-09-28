begin;
insert into auth.users(id) values ('88888888-8888-4888-8888-888888888881'), ('88888888-8888-4888-8888-888888888882');
insert into public.profiles(user_id,username,lines_added,updated_at) values
  ('88888888-8888-4888-8888-888888888881','content_owner',123,'2026-01-01'),
  ('88888888-8888-4888-8888-888888888882','content_other',456,'2026-01-01');
create temp table content_before as select to_jsonb(p) value from public.profiles p where username='content_owner';
grant select on content_before to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888881',true);
do $$ declare layout jsonb := '{"version":3,"modules":[{"type":"stat_grid","id":"sec_grid","visible":true,"size":"two_thirds","columns":2,"rows":2,"cells":["sessions.average_ms",null,"activity.edits","activity.edits"]},{"type":"document","id":"sec_doc","visible":true,"size":"third","title":"Research","url":"https://example.com/paper.pdf"}]}'; begin
  perform public.update_profile_layout(layout);
  assert (select profile_layout from public.profiles where username='content_owner') = layout;
  assert (select to_jsonb(p) - 'profile_layout' from public.profiles p where username='content_owner') = (select value - 'profile_layout' from content_before), 'Layout saves must preserve manual values, appearance and timestamps';
  assert (select profile_layout from public.profiles where username='content_other') is null;
  update public.profiles set profile_layout=layout where username='content_other';
  assert not found, 'RLS must deny another owner write';
  begin
    update public.profiles set profile_layout=jsonb_set(layout,'{modules,0,cells,0}','"projects.activity"') where username='content_owner';
    raise exception 'CHECK accepted a private metric';
  exception when check_violation then null; end;
  begin
    perform public.update_profile_layout(jsonb_set(layout,'{modules,1,url}','"javascript:alert(1)"'));
    raise exception 'RPC accepted a script URL';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  assert not exists(select 1 from public.sync_privacy where user_id='88888888-8888-4888-8888-888888888881'), 'Layout selection must never publish metrics';
  assert not has_function_privilege('anon','public.profile_layout_v2_is_valid(jsonb)','EXECUTE');
  assert not has_function_privilege('anon','public.profile_external_link_is_valid(text)','EXECUTE');
end $$;
set local role anon;
do $$ begin
  assert (select profile_layout ->> 'version' from public.profiles where username='content_owner') = '3';
  begin
    perform public.update_profile_layout(null);
    raise exception 'Anonymous layout RPC accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
