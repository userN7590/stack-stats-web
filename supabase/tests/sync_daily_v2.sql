-- Disposable database fixtures only; never run this test file in production.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.profiles(user_id,username,lines_added) values('11111111-1111-4111-8111-111111111111','rich_one',123),('22222222-2222-4222-8222-222222222222','rich_two',456);
create function pg_temp.rich_day() returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion','2','aggregationVersion',1,'date',current_date::text,'revision',2,
 'activeMs',30000,'editCount',2,'linesAdded',4,'linesRemoved',2,'sessionDays',1,'sessionStarts',1,'incompleteSessionStarts',0,'fileCount',1,'projectCount',1,'languageCount',1,
 'languages','[{"id":"typescript","activeMs":30000,"editCount":2,"linesAdded":4,"linesRemoved":2}]'::jsonb,
 'projects',jsonb_build_array(jsonb_build_object('id',repeat('a',64),'activeMs',30000,'editCount',2,'linesAdded',4,'linesRemoved',2)),
 'projectOverflow','{"projectCount":0,"activeMs":0,"editCount":0,"linesAdded":0,"linesRemoved":0}'::jsonb,
 'sessionDurations','{"count":1,"activeMs":30000,"editCount":2,"linesAdded":4,"linesRemoved":2,"minActiveMs":30000,"maxActiveMs":30000,"histogram":[0,1,0,0,0,0,0,0,0]}'::jsonb,
 'hourlyUtc',null,'coverage',jsonb_build_object('source','sessions-v1','dateBasis','collector-local','firstObservedDate',current_date::text,'lastObservedDate',current_date::text,'uploadFromDate',(current_date-89)::text,'historyCompleteness','unknown','partial',true));
$$;
do $$
declare p jsonb:=pg_temp.rich_day(); old jsonb; next_day jsonb; second jsonb; identity_pair jsonb; legacy_pair jsonb; rich_pair jsonb; foreign_pair jsonb; result jsonb; summary jsonb; selected jsonb; data jsonb; rotated jsonb;
 verifier text:='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'; challenge text:='E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'; callback text:='vscode://undefined_publisher.stack-stats-vscode/auth/callback';
 install uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; other_install uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; legacy_install uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc'; metric text; language_row jsonb;
begin
 assert public.sync_validate_day_v2(p);
 assert public.sync_period_from('90',date '2000-01-01')=date '2000-01-01';
 assert not public.sync_validate_day_v2(null);
 assert not public.sync_validate_day_v2(p||jsonb_build_object('private',repeat('x',65536)));
 assert not public.sync_validate_day(p);
 old := (p-array['sessionDays','sessionStarts','incompleteSessionStarts','projectCount','languageCount','projectOverflow','sessionDurations','hourlyUtc','coverage']) || '{"schemaVersion":"1","sessionCount":1,"revision":1}';
 assert public.sync_validate_day(old);
 assert not public.sync_validate_day_v2(old);
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 identity_pair:=public.extension_exchange(public.extension_authorize(challenge,callback),verifier,callback);
 legacy_pair:=public.extension_exchange(public.extension_authorize_stats(challenge,callback),verifier,callback);
 rich_pair:=public.extension_exchange(public.extension_authorize_stats_v2(challenge,callback),verifier,callback);
 begin perform public.sync_capabilities(identity_pair->>'accessToken'); raise exception 'Identity connection negotiated uploads'; exception when sqlstate '42501' then null; end;
 assert public.sync_capabilities(legacy_pair->>'accessToken')='{"schemaVersion":"1","dailyVersions":["1"]}'::jsonb;
 assert public.sync_capabilities(rich_pair->>'accessToken')='{"schemaVersion":"1","dailyVersions":["1","2"]}'::jsonb;
 assert (select stats_schema_version=2 and stats_consent_at is not null from public.extension_connections where id=(rich_pair->>'syncGrant')::uuid);
 begin perform public.sync_put_day(legacy_pair->>'accessToken',install,current_date,p); raise exception 'Legacy grant uploaded richer data'; exception when sqlstate '42501' then null; end;
 assert public.sync_put_day(legacy_pair->>'accessToken',install,current_date,old)->>'error' is null;
 summary:=public.sync_private_summary_v2('30',current_date);
 assert summary->'sessionStarts'='null'::jsonb and summary->'sessionDurations'='null'::jsonb and summary->'hourlyUtc'='null'::jsonb;
 assert summary->>'sessionDays'='1' and summary#>>'{coverage,v1Records}'='1';
 result:=public.sync_put_day(rich_pair->>'accessToken',install,current_date,p);
 assert result->>'schemaVersion'='2' and result->>'revision'='2' and result->>'unchanged'='false';
 assert (select count(*) from public.sync_days)=1, 'Promotion must replace, not add a second version';
 update public.sync_days set updated_at='2026-01-01' where installation_id=install;
 result:=public.sync_put_day(rich_pair->>'accessToken',install,current_date,p);
 assert result->>'schemaVersion'='2' and result->>'unchanged'='true';
 assert (select updated_at='2026-01-01' from public.sync_days where installation_id=install), 'Lost-response retry must not rewrite row';
 assert public.sync_put_day(rich_pair->>'accessToken',install,current_date,p||'{"revision":1}')->>'error'='stale_revision';
 assert public.sync_put_day(rich_pair->>'accessToken',install,current_date,p||'{"fileCount":2}')->>'error'='revision_conflict';
 assert public.sync_put_day(legacy_pair->>'accessToken',install,current_date,old||'{"revision":999}')->>'error'='version_downgrade';
 assert public.sync_put_day(rich_pair->>'accessToken',install,current_date,p||'{"schemaVersion":"3"}')->>'error'='invalid_request';
 second:=p||'{"sessionStarts":2,"sessionDurations":{"count":2,"activeMs":90000,"editCount":5,"linesAdded":10,"linesRemoved":3,"minActiveMs":30000,"maxActiveMs":60000,"histogram":[0,1,1,0,0,0,0,0,0]}}';
 assert public.sync_validate_day_v2(second);
 assert public.sync_put_day(rich_pair->>'accessToken',other_install,current_date,second)->>'error' is null;
 assert public.sync_put_day(legacy_pair->>'accessToken',legacy_install,current_date,old)->>'error' is null;
 summary:=public.sync_private_summary_v2('30',current_date);
 assert summary->>'activeMs'='90000' and summary->>'sessionDays'='3' and summary->>'fileDays'='3';
 assert summary->>'sessionStarts'='3' and summary->>'activeDays'='1';
 assert (summary#>>'{sessionDurations,averageActiveMs}')::numeric=40000, 'Use cohort sums/count, never average daily averages';
 assert summary#>>'{sessionDurations,count}'='3' and summary#>>'{sessionDurations,activeMs}'='120000';
 assert summary#>>'{sessionDurations,maxActiveMs}'='60000' and summary#>>'{sessionDurations,minActiveMs}'='30000';
 assert summary#>'{sessionDurations,histogram}'='[0,2,1,0,0,0,0,0,0]'::jsonb;
 assert summary->>'projectKnownCount'='3', 'Same alias across installations must remain separate';
 assert summary->>'languageCount'='1' and summary#>>'{languages,0,activeMs}'='90000';
 assert summary#>>'{coverage,v1Records}'='1' and summary#>>'{coverage,v2Records}'='2' and summary#>>'{coverage,partial}'='true';
 assert public.sync_private_summary('30',current_date)->>'sessionDays'='3';
 -- Hourly is a separate UTC population and need not equal local counters.
 p:=jsonb_set(p||'{"revision":3}','{hourlyUtc}',jsonb_build_object('source','telemetry-v2','dateBasis','UTC',
 'activeMsByHour',to_jsonb(array_fill(1000,array[24])),'editCountByHour',to_jsonb(array_fill(1,array[24])),
 'linesAddedByHour',to_jsonb(array_fill(2,array[24])),'linesRemovedByHour',to_jsonb(array_fill(0,array[24])),
 'coverage',jsonb_build_object('firstObservedDate',current_date::text,'lastObservedDate',current_date::text,'partial',true,'frozen',true,'lateInputIgnored',true)));
 assert public.sync_validate_day_v2(p);
 assert public.sync_put_day(rich_pair->>'accessToken',install,current_date,p)->>'error' is null;
 second:=jsonb_set(second||'{"revision":3}','{hourlyUtc}',p->'hourlyUtc');
 assert public.sync_put_day(rich_pair->>'accessToken',other_install,current_date,second)->>'error' is null;
 summary:=public.sync_private_summary_v2('30',current_date);
 assert summary#>>'{hourlyUtc,activeMsByHour,0}'='2000' and summary#>>'{coverage,hourlyRecords}'='2';
 assert summary->>'activeMs'='90000' and summary#>>'{coverage,frozenHourlyRecords}'='2' and summary#>>'{coverage,lateInputIgnoredRecords}'='2';
 data:=public.sync_private_datasets_v2('7',current_date,'hourlyUtc');
 assert data->>'dateBasis'='UTC' and data#>>'{rows,0,hourlyUtc,activeMsByHour,23}'='2000';
 data:=public.sync_private_datasets_v2('7',current_date,'daily');
 assert data->>'dateBasis'='collector-local' and data#>>'{rows,0,activeMs}'='90000';
 assert jsonb_array_length(public.sync_private_datasets_v2('7',current_date,'languagesByDay')->'rows')=1;
 assert jsonb_array_length(public.sync_private_datasets_v2('7',current_date,'projectsByDay')->'rows')=3;
 assert public.sync_private_datasets_v2('7',current_date,'sessionStartCohorts')#>>'{rows,0,sessionStarts}'='3';
 begin perform public.sync_private_datasets_v2('lifetime',current_date,'daily'); raise exception 'Unbounded dataset allowed'; exception when sqlstate '22023' then null; end;
 -- Legacy publication keeps only its previous allowlist, including on mixed rows.
 perform public.sync_set_privacy(true,true);
 result:=public.sync_public_profile('rich_one');
 assert result->>'activeMs'='90000' and result->>'projectCount'='3';
 assert not result ?| array['sessionStarts','sessionDurations','coverage','hourlyUtc','projects','date','installationId'];
 assert public.sync_public_profile_v2('rich_one') is null;
 -- Selective publication must not leak unselected values via a legacy fallback.
 perform public.sync_set_privacy_v2(true,'["activity.active_ms"]',false);
 assert public.sync_public_profile('rich_one') is null;
 result:=public.sync_public_profile_v2('rich_one');
 assert jsonb_array_length(result->'metrics')=1 and result#>>'{metrics,0,id}'='activity.active_ms';
 assert result#>>'{metrics,0,value}'='90000' and not (result->'metrics'->0 ?| array['coverage','date','histogram']);
 begin perform public.sync_set_privacy(true,true); raise exception 'Old UI restored broad publication'; exception when sqlstate '22023' then null; end;
 begin perform public.sync_set_privacy_v2(true,'["schedule.daily"]',false); raise exception 'Schedule consent bypass'; exception when sqlstate '22023' then null; end;
 begin perform public.sync_set_privacy_v2(true,'["projects.activity"]',true); raise exception 'Project identities public'; exception when sqlstate '22023' then null; end;
 begin perform public.sync_set_privacy_v2(true,'["activity.edits","activity.edits"]',false); raise exception 'Duplicate selections'; exception when sqlstate '22023' then null; end;
 perform public.sync_set_privacy_v2(true,'[]',false);
 assert public.sync_public_profile_v2('rich_one')->'metrics'='[]'::jsonb and public.sync_public_profile('rich_one') is null;
 perform public.sync_set_privacy_v2(true,to_jsonb(public.sync_public_metric_ids()),true);
 result:=public.sync_public_profile_v2('rich_one');
 assert jsonb_array_length(result->'metrics')=19;
 assert result::text not like '%installationId%' and result::text not like '%firstObservedDate%' and result::text not like '%project%';
 assert result::text not like '%'||repeat('a',64)||'%';
 -- Withdrawing hourly replaces the optional field; other daily data survives.
 p:=p||'{"revision":4,"hourlyUtc":null}';
 assert public.sync_put_day(rich_pair->>'accessToken',install,current_date,p)->>'error' is null;
 assert public.sync_private_summary_v2('30',current_date)#>>'{hourlyUtc,activeMsByHour,0}'='1000', 'Other installation hourly data survives withdrawal';
 second:=second||'{"revision":4,"hourlyUtc":null}';
 assert public.sync_put_day(rich_pair->>'accessToken',other_install,current_date,second)->>'error' is null;
 assert public.sync_private_summary_v2('30',current_date)->'hourlyUtc'='null'::jsonb;
 -- Source overflow changes period identities to a lower bound. Counters survive.
 select jsonb_agg(jsonb_build_object('id',lpad(to_hex(i),64,'0'),'activeMs',0,'editCount',0,'linesAdded',0,'linesRemoved',0) order by i) into selected from generate_series(0,127) i;
 p:=p||jsonb_build_object('revision',5,'projects',selected,'projectCount',129,'fileCount',129,'projectOverflow',jsonb_build_object('projectCount',1,'activeMs',30000,'editCount',2,'linesAdded',4,'linesRemoved',2));
 assert public.sync_validate_day_v2(p);
 assert public.sync_put_day(rich_pair->>'accessToken',install,current_date,p)->>'error' is null;
 summary:=public.sync_private_summary_v2('30',current_date);
 assert summary->>'projectIdentityComplete'='false' and summary#>>'{projectOverflow,projectDays}'='1';
 assert summary->>'projectKnownCount'='130' and jsonb_array_length(summary->'projects')=128;
 assert summary#>>'{projectSelectionRemainder,knownIdentities}'='2';
 assert public.sync_private_summary('30',current_date)->'projectCount'='null'::jsonb;
 data:=public.sync_private_datasets_v2('7',current_date,'projectsByDay');
 assert exists(select 1 from jsonb_array_elements(data->'rows') r where r->>'overflow'='true' and r->>'activeMs'='30000');
 -- Refresh is connection-preserving and cannot change consent version.
 rotated:=public.extension_refresh_stats(rich_pair->>'refreshToken',repeat('d',64));
 assert public.sync_capabilities(rotated->>'accessToken')->'dailyVersions'='["1","2"]'::jsonb;
 assert public.extension_refresh_stats(rich_pair->>'refreshToken',repeat('d',64))->>'syncGrant'=rich_pair->>'syncGrant';
 data:=public.sync_export_v2(); assert jsonb_array_length(data->'rows')=3;
 next_day:=jsonb_set(old,'{date}',to_jsonb((current_date-1)::text));
 assert public.sync_put_day(legacy_pair->>'accessToken',legacy_install,current_date-1,next_day)->>'error' is null;
 summary:=public.sync_private_summary_v2('7',current_date);
 assert summary->>'activeDays'='2' and summary#>>'{coverage,uploadedDates}'='2';
 assert jsonb_array_length(public.sync_private_datasets_v2('7',current_date,'daily')->'rows')=2;
 begin perform public.sync_checked_result('{"n":9007199254740992}'); raise exception 'Aggregate precision silently lost'; exception when sqlstate '54000' then null; end;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 assert public.sync_private_summary_v2()->'sessionStarts'='null'::jsonb;
 assert public.sync_private_summary_v2()#>>'{coverage,recordCount}'='0';
 assert public.sync_export_v2()->'rows'='[]'::jsonb;
 assert public.sync_private_datasets_v2('7',current_date,'hourlyUtc')->'rows'='[]'::jsonb;
 foreign_pair:=public.extension_exchange(public.extension_authorize_stats_v2(challenge,callback),verifier,callback);
 next_day:=pg_temp.rich_day()||'{"revision":1,"activeMs":0,"editCount":0,"linesAdded":0,"linesRemoved":0,"sessionDays":0,"sessionStarts":0,"incompleteSessionStarts":0,"fileCount":0,"projectCount":0,"languageCount":0,"languages":[],"projects":[],"sessionDurations":{"count":0,"activeMs":0,"editCount":0,"linesAdded":0,"linesRemoved":0,"minActiveMs":null,"maxActiveMs":null,"histogram":[0,0,0,0,0,0,0,0,0]}}';
 next_day:=jsonb_set(next_day,'{coverage,firstObservedDate}','null');
 next_day:=jsonb_set(next_day,'{coverage,lastObservedDate}','null');
 assert public.sync_put_day(foreign_pair->>'accessToken',install,current_date,next_day)->>'error' is null;
 summary:=public.sync_private_summary_v2();
 assert summary#>>'{sessionDurations,count}'='0' and summary#>'{sessionDurations,averageActiveMs}'='null'::jsonb;
 assert summary#>'{sessionDurations,histogram}'='[0,0,0,0,0,0,0,0,0]'::jsonb;
 assert summary#>>'{coverage,v2Records}'='1';
 assert public.sync_put_day(foreign_pair->>'accessToken',install,current_date,pg_temp.rich_day())->>'error' is null;
 assert public.sync_private_summary_v2()->>'activeMs'='30000';
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.sync_erase_cloud_data();
 assert public.sync_export_v2()->'rows'='[]'::jsonb;
 assert not exists(select 1 from public.extension_connections where user_id=auth.uid() and scope='stats:write');
 assert exists(select 1 from public.extension_connections where user_id=auth.uid() and scope='identity');
 assert (select lines_added from public.profiles where user_id=auth.uid())=123;
 assert (select count(*) from public.sync_days)=1, 'Other owner records survive erasure';
 begin perform public.sync_put_day(rotated->>'accessToken',install,current_date,p); raise exception 'Erased grant recreated records'; exception when sqlstate '28000' then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.sync_private_summary_v2(); raise exception 'No user read summary'; exception when sqlstate '28000' then null; end;
 begin perform public.sync_erase_cloud_data(); raise exception 'No user erased data'; exception when sqlstate '28000' then null; end;
end $$;
-- Actual client roles cannot call helpers or read private tables directly.
set local role anon;
do $$ begin
 begin perform public.sync_private_summary_v2(); raise exception 'anon private read'; exception when insufficient_privilege then null; end;
 begin perform public.sync_aggregate_v2('11111111-1111-4111-8111-111111111111',current_date,current_date); raise exception 'anon reducer'; exception when insufficient_privilege then null; end;
 begin perform public.extension_authorize_stats_v2('x','x'); raise exception 'anon consent'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.sync_days; raise exception 'anon raw read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform public.sync_validate_day_v2('{}'); raise exception 'client helper'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.sync_days; raise exception 'client raw read'; exception when insufficient_privilege then null; end;
 begin update public.extension_connections set stats_schema_version=2,stats_consent_at=now(); raise exception 'client consent escalation'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
