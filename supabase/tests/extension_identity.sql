-- Run only in a disposable database with the application migrations applied.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.profiles(user_id, username, lines_added) values
 ('11111111-1111-4111-8111-111111111111', 'auth_test_one', 123),
 ('22222222-2222-4222-8222-222222222222', 'auth_test_two', 456);

do $$
declare code text; pair jsonb; renewed jsonb; other jsonb; account jsonb;
  verifier text := 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  challenge text := 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  callback text := 'vscode://undefined_publisher.stack-stats-vscode/auth/callback';
begin
  assert not has_table_privilege('anon', 'public.extension_connections', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.extension_access_tokens', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.extension_auth_codes', 'INSERT');
  assert not has_function_privilege('anon', 'public.extension_authorize(text,text)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.extension_revoke_all()', 'EXECUTE');
  assert has_function_privilege('anon', 'public.extension_exchange(text,text,text)', 'EXECUTE');
  begin perform public.extension_authorize(challenge, callback); raise exception 'anonymous authorization succeeded'; exception when sqlstate '28000' then null; end;
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  code := public.extension_authorize(challenge, callback);
  assert code ~ '^[a-f0-9]{64}$';
  assert not exists(select 1 from public.extension_auth_codes where code_hash = code);
  begin perform public.extension_exchange(code, repeat('x', 43), callback); raise exception 'bad verifier accepted'; exception when sqlstate '28000' then null; end;
  begin perform public.extension_exchange(code, verifier, callback || '/evil'); raise exception 'wrong callback accepted'; exception when sqlstate '28000' then null; end;
  pair := public.extension_exchange(code, verifier, callback);
  assert pair->'account'->>'username' = 'auth_test_one';
  assert (pair->>'expiresAt')::timestamptz <= now() + interval '15 minutes';
  assert (pair->>'refreshExpiresAt')::timestamptz <= now() + interval '30 days';
  begin perform public.extension_exchange(code, verifier, callback); raise exception 'code replay accepted'; exception when sqlstate '28000' then null; end;
  assert public.extension_account(pair->>'accessToken')->>'userId' = '11111111-1111-4111-8111-111111111111';
  assert not exists(select 1 from public.extension_connections where refresh_hash = pair->>'refreshToken');
  assert not exists(select 1 from public.extension_access_tokens where token_hash = pair->>'accessToken');
  update public.profiles set display_name = 'Updated' where username = 'auth_test_one';
  assert public.extension_account(pair->>'accessToken')->>'displayName' = 'Updated';
  update public.extension_access_tokens set expires_at = now() - interval '1 second';
  begin perform public.extension_account(pair->>'accessToken'); raise exception 'expired access accepted'; exception when sqlstate '28000' then null; end;
  renewed := public.extension_refresh(pair->>'refreshToken');
  assert renewed->>'accessToken' <> pair->>'accessToken';
  assert renewed->>'refreshExpiresAt' = pair->>'refreshExpiresAt';
  assert public.extension_account(renewed->>'accessToken')->>'username' = 'auth_test_one';
  code := public.extension_authorize(challenge, callback);
  update public.extension_auth_codes set expires_at = now() - interval '1 second';
  begin perform public.extension_exchange(code, verifier, callback); raise exception 'expired code accepted'; exception when sqlstate '28000' then null; end;
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  code := public.extension_authorize(challenge, callback);
  other := public.extension_exchange(code, verifier, callback);
  perform public.extension_revoke_all();
  begin perform public.extension_account(other->>'accessToken'); raise exception 'revoked owner accepted'; exception when sqlstate '28000' then null; end;
  assert public.extension_account(renewed->>'accessToken')->>'username' = 'auth_test_one';
  perform public.extension_revoke(pair->>'refreshToken');
  perform public.extension_revoke(pair->>'refreshToken'); -- idempotent
  begin perform public.extension_refresh(pair->>'refreshToken'); raise exception 'revoked refresh accepted'; exception when sqlstate '28000' then null; end;
  assert (select lines_added from public.profiles where username = 'auth_test_one') = 123;
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  code := public.extension_authorize(challenge, callback); pair := public.extension_exchange(code, verifier, callback);
  update public.extension_connections set expires_at = now() - interval '1 second';
  begin perform public.extension_refresh(pair->>'refreshToken'); raise exception 'expired refresh accepted'; exception when sqlstate '28000' then null; end;
  code := public.extension_authorize(challenge, callback); pair := public.extension_exchange(code, verifier, callback);
  delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
  begin perform public.extension_account(pair->>'accessToken'); raise exception 'deleted account accepted'; exception when sqlstate '28000' then null; end;
  assert not exists(select 1 from public.extension_connections where user_id = '11111111-1111-4111-8111-111111111111');
  raise notice 'Extension identity SQL assertions passed: grants, PKCE, replay, expiry, scopes, isolation, revocation, deletion and hash-only storage.';
end $$;
rollback;
