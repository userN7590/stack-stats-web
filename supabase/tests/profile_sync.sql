-- Disposable database only. All fixtures roll back.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.profiles(user_id,username,lines_added) values('11111111-1111-4111-8111-111111111111','sync_one',123),('22222222-2222-4222-8222-222222222222','sync_two',456);
do $$
declare code text; pair jsonb; identity_pair jsonb; second_pair jsonb; rotated jsonb; retry jsonb; result jsonb; summary jsonb;
 verifier text:='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'; challenge text:='E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
 callback text:='vscode://undefined_publisher.stack-stats-vscode/auth/callback';
 install uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; other_install uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 p jsonb; newer jsonb;
begin
 assert not has_table_privilege('anon','public.sync_days','SELECT');
 assert not has_table_privilege('authenticated','public.sync_days','INSERT');
 assert not has_table_privilege('authenticated','public.sync_privacy','UPDATE');
 assert not has_function_privilege('anon','public.sync_aggregate(uuid,date,date)','EXECUTE');
 assert not has_function_privilege('authenticated','public.sync_aggregate(uuid,date,date)','EXECUTE');
 assert not has_function_privilege('anon','public.sync_private_summary(text,date)','EXECUTE');
 assert not has_function_privilege('anon','public.extension_authorize_stats(text,text)','EXECUTE');
 assert not has_table_privilege('anon','public.extension_refresh_history','SELECT');
 p:=jsonb_build_object('schemaVersion','1','aggregationVersion',1,'date',current_date::text,'revision',1,
 'activeMs',30000,'editCount',2,'linesAdded',4,'linesRemoved',2,'sessionCount',1,'fileCount',1,
 'languages',jsonb_build_array(jsonb_build_object('id','typescript','activeMs',30000,'editCount',2,'linesAdded',4,'linesRemoved',2)),
 'projects',jsonb_build_array(jsonb_build_object('id',repeat('a',64),'activeMs',30000,'editCount',2,'linesAdded',4,'linesRemoved',2)));
 assert public.sync_validate_day(p);
 assert not public.sync_validate_day(p||'{"userId":"forged"}');
 assert not public.sync_validate_day(p||'{"date":"2026-02-30"}');
 assert not public.sync_validate_day(p||'{"linesAdded":5}');
 assert not public.sync_validate_day(p||'{"activeMs":-1}');
 assert not public.sync_validate_day(p||'{"revision":1.1}');
 assert not public.sync_validate_day(p||'{"schemaVersion":1}');
 assert not public.sync_validate_day(jsonb_set(p,'{languages,0,id}','"private-custom-name"'));
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 code:=public.extension_authorize(challenge,callback); identity_pair:=public.extension_exchange(code,verifier,callback);
 begin perform public.sync_put_day(identity_pair->>'accessToken',install,current_date,p); raise exception 'identity token uploaded'; exception when sqlstate '42501' then null; end;
 code:=public.extension_authorize_stats(challenge,callback);
 begin perform public.extension_exchange(code,repeat('x',43),callback); raise exception 'bad PKCE accepted'; exception when sqlstate '28000' then null; end;
 pair:=public.extension_exchange(code,verifier,callback); assert pair->>'syncGrant' is not null;
 begin perform public.extension_refresh(pair->>'refreshToken'); raise exception 'nonrotating refresh accepted'; exception when sqlstate '28000' then null; end;
 result:=public.sync_put_day(pair->>'accessToken',install,current_date,p); assert result->>'revision'='1' and result->>'error' is null;
 result:=public.sync_put_day(pair->>'accessToken',install,current_date,p); assert result->>'unchanged'='true';
 assert (select count(*) from public.sync_days)=1;
 assert public.sync_public_profile('sync_one') is null;
 assert public.sync_get_privacy()='{"publishProfile":false,"publishLanguages":false}'::jsonb;
 newer:=jsonb_set(p,'{revision}','2');
 result:=public.sync_put_day(pair->>'accessToken',install,current_date,newer); assert result->>'revision'='2';
 result:=public.sync_put_day(pair->>'accessToken',install,current_date,p); assert result->>'error'='stale_revision';
 result:=public.sync_put_day(pair->>'accessToken',install,current_date,newer||'{"fileCount":2}'); assert result->>'error'='revision_conflict';
 result:=public.sync_put_day(pair->>'accessToken',install,current_date,p||'{"sourceCode":"never"}'); assert result->>'error'='invalid_request';
 result:=public.sync_put_day(pair->>'accessToken',install,current_date+2,jsonb_set(p,'{date}',to_jsonb((current_date+2)::text))); assert result->>'error'='invalid_request';
 result:=public.sync_put_day(pair->>'accessToken',other_install,current_date,p); assert result->>'revision'='1';
 result:=public.sync_put_day(pair->>'accessToken',install,current_date-10,jsonb_set(p,'{date}',to_jsonb((current_date-10)::text))); assert result->>'revision'='1';
 summary:=public.sync_private_summary('7',current_date); assert summary->>'activeMs'='60000' and summary->>'activeDays'='1' and summary->>'projectCount'='2';
 summary:=public.sync_private_summary('30',current_date); assert summary->>'activeMs'='90000' and summary->>'sessionDays'='3' and summary->>'fileDays'='3';
 assert jsonb_array_length(summary->'activeDates')=2;
 assert public.sync_private_summary('90',current_date)->>'activeMs'='90000';
 assert public.sync_private_summary('lifetime',current_date)->>'linesAdded'='12';
 perform public.sync_set_privacy(true,false);
 result:=public.sync_public_profile('sync_one'); assert result->>'linesAdded'='12' and result->'languages'='[]'::jsonb;
 assert not result ?| array['projects','activeDates','sessionDays','userId','installationId'];
 perform public.sync_set_privacy(true,true); assert jsonb_array_length(public.sync_public_profile('sync_one')->'languages')=1;
 assert (select lines_added from public.profiles where username='sync_one')=123;
 perform public.sync_set_privacy(false,false); assert public.sync_public_profile('sync_one') is null;
 -- Another account may use an identical installation UUID only in its own
 -- namespace; no submitted user identifier exists and originals cannot change.
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 code:=public.extension_authorize_stats(challenge,callback); second_pair:=public.extension_exchange(code,verifier,callback);
 result:=public.sync_put_day(second_pair->>'accessToken',install,current_date,p); assert result->>'revision'='1';
 assert public.sync_private_summary('lifetime',current_date)->>'activeMs'='30000';
 assert (select revision from public.sync_days where user_id='11111111-1111-4111-8111-111111111111' and installation_id=install and date=current_date)=2;
 assert (select count(*) from public.sync_days)=4;
 -- Rotation, lost-response recovery, family revocation on conflicting replay.
 rotated:=public.extension_refresh_stats(pair->>'refreshToken',repeat('d',64));
 assert rotated->>'refreshToken'=repeat('d',64) and rotated->>'refreshExpiresAt'=pair->>'refreshExpiresAt';
 retry:=public.extension_refresh_stats(pair->>'refreshToken',repeat('d',64)); assert retry->>'refreshToken'=rotated->>'refreshToken';
 assert not exists(select 1 from public.extension_refresh_history where token_hash=pair->>'refreshToken');
 assert public.extension_refresh_stats(pair->>'refreshToken',repeat('e',64)) is null;
 begin perform public.sync_put_day(rotated->>'accessToken',install,current_date,p); raise exception 'revoked family uploaded'; exception when sqlstate '28000' then null; end;
 update public.extension_access_tokens set expires_at=now()-interval '1 second' where token_hash=encode(extensions.digest(second_pair->>'accessToken','sha256'),'hex');
 begin perform public.sync_put_day(second_pair->>'accessToken',install,current_date,p); raise exception 'expired token uploaded'; exception when sqlstate '28000' then null; end;
 rotated:=public.extension_refresh_stats(second_pair->>'refreshToken',repeat('f',64));
 update public.sync_rate_limits set requests=60,window_start=now() where user_id='22222222-2222-4222-8222-222222222222';
 assert public.sync_put_day(rotated->>'accessToken',install,current_date,p)->>'error'='rate_limited';
 delete from auth.users where id='22222222-2222-4222-8222-222222222222';
 assert not exists(select 1 from public.sync_days where user_id='22222222-2222-4222-8222-222222222222');
 assert (select count(*) from public.sync_days)=3;
 begin perform public.sync_put_day(rotated->>'accessToken',install,current_date,p); raise exception 'deleted account uploaded'; exception when sqlstate '28000' then null; end;
 raise notice 'Profile sync SQL assertions passed: validation, scopes, PKCE, rotation/replay, revision ordering, idempotence, multi-installation ownership, aggregation windows, privacy, manual preservation, limits, expiry, deletion.';
end $$;
rollback;
