# Production account linking and sync: v0.5.0

## Audit findings — 2026-09-18

The working checkout and GitHub `main` were at `c97f8ae`, the manual-profile
application. The existing implementation was found in a separate local checkout,
`/Users/fstopyra/Desktop/stack-stats-web`, commit
`7af2b7558d42ed4308abca1a32b9f83c570508c4`. Its 43-file change was restored here.
That source checkout's uncommitted package/Supabase configuration changes were
not copied. No extension code was changed.

The extension was inspected directly at
`/Users/fstopyra/Desktop/projects/stack-stats`, commit `2ce148d`, version 0.5.0:
`account-service.ts`, `vscode-account.ts`, `profile-sync.ts`, the manifest, and
`packages/protocol/src/sync.ts`. The web daily contract is byte-for-byte identical
to that protocol file. No extension contract mismatch was found.

Read-only production checks found:

- `https://stackstats.dev` serves the earlier application.
- Every extension and sync route listed below returned 404.
- The old email callback responded without `no-store`; the new production route
  smoke check detects this as well as the missing routes.
- The publicly bundled Supabase configuration identifies project
  `pmzrqkmhdbshuoknyosi`. Requests using that public key and invalid credentials
  returned `404/PGRST202` for `extension_account`, `extension_exchange`,
  `extension_refresh`, `extension_refresh_stats`, `sync_put_day`, and
  `sync_public_profile`. These functions are unavailable in the live REST schema.
  The privileged migration ledger was not accessible; confirm its actual state
  before applying migrations. Do not assume that a missing REST function alone
  proves a particular migration-history state.
- The other checkout's `.env.local` points to local Supabase and localhost. It
  must not be copied to Vercel Production.

No production settings, accounts, telemetry, migrations, or deployments were
changed during this audit. Hosted login, email delivery, and the OS deep link
remain unverified until the rollout and manual test below are completed.

Additional corrections made here:

- Confirmation success and failure redirects use `STACK_STATS_APP_ORIGIN`,
  retain the complete validated continuation, and send `no-store` and
  `no-referrer`. An internal proxy hostname cannot redirect users to localhost.
- Invalid database arguments, malformed/oversized privacy requests, and invalid
  summary dates return 400 instead of a retryable 503.
- `.env.example` now documents production origin, public credentials, and the
  optional exact callback allowlist.
- Added continuation/callback regressions, a no-credentials route smoke check,
  a disposable database test runner, and read-only hosted schema assertions.

## Existing contract retained

| Method and path | Authentication and behavior |
| --- | --- |
| `GET /extension/connect` | Browser login, profile setup if needed, explicit approval; no parameters opens connection management |
| `POST /api/extension/authorize` | Fresh Supabase browser user + exact Origin; `{challenge,state,redirectUri}` for identity, optional `scope:"stats:write"` for uploads |
| `POST /api/extension/exchange` | `{code,verifier,redirectUri}`; one-time 90-second code, S256 PKCE and exact callback |
| `POST /api/extension/refresh` | `{refreshToken}` for identity; `{refreshToken,nextRefreshToken}` for rotating stats credentials |
| `POST /api/extension/revoke` | Possession of the refresh token, including a rotated predecessor; idempotent revocation |
| `POST /api/extension/revoke-all` | Fresh browser user + exact Origin; current user's connections and pending codes only |
| `GET /api/extension/account` | Opaque bearer token; account identity only |
| `PUT /api/v1/sync/installations/[installationId]/days/[date]` | Bearer token with `stats:write`; strict daily v1 aggregate; owner derived from connection |
| `GET /api/v1/sync/summary?period=30` | Browser user only; `7`, `30`, `90`, `lifetime`; optional `to=YYYY-MM-DD` |
| `PUT /api/v1/sync/privacy` | Browser user + exact Origin; `{publishProfile,publishLanguages}` |
| `GET /settings/sync` | Existing private summary and publication controls |
| `GET /u/[username]` | Public profile; `sync_public_profile` returns published totals only |

Exchange/refresh return `accessToken`, `refreshToken`, `expiresAt`,
`refreshExpiresAt`, and `account:{userId,username,displayName,profileUrl}`.
Only a newly approved stats grant includes `syncGrant` (the connection UUID).
Access lasts 15 minutes; delegation expires absolutely after 30 days. Stats
refreshes rotate and support retry of the same predecessor/successor pair.

The editor callback contains only `code` + `ss_state`, or `error=access_denied`
+ `ss_state`. The extension checks state against its pending SecretStorage entry.
The verifier and access/refresh credentials never enter callback URLs. The
database stores only SHA-256 credential hashes. No browser Supabase session is
transferred to the extension.

Upload grants also permit the existing account identity check, which v0.5.0
requires. They cannot edit profiles, appearance or publication, read private
summaries, or select private tables. Identity grants cannot upload. All private
tables have RLS and no direct `anon`/`authenticated` access; narrow functions
enforce credentials, scope and ownership independently of Next.js.

The payload contains exactly `schemaVersion:"1"`, `aggregationVersion:1`,
`date`, `revision`, `activeMs`, `editCount`, `linesAdded`, `linesRemoved`,
`sessionCount`, `fileCount`, `languages`, and `projects`. Breakdown arrays are
sorted, unique and sum to the daily counters. The path date must match the body.
No account ID, source, filenames, or unknown properties are accepted. Identical
revisions are unchanged successes; stale/conflicting revisions return 409;
newer revisions replace the day rather than add it again. Ownership is always
derived from the access token, never from a submitted account or installation ID.

Private upload and public publication are separate. Publication defaults off;
language publication is another explicit choice. Published totals replace the
displayed manual totals without rewriting manual rows. Unpublishing restores
manual display. Project pseudonyms and daily activity dates remain private.

## Exact Vercel Production environment

Set these on the Vercel project actually serving `stackstats.dev`, in the
**Production** environment, before building the release:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://pmzrqkmhdbshuoknyosi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key-from-project-pmzrqkmhdbshuoknyosi>
STACK_STATS_APP_ORIGIN=https://stackstats.dev
```

The first two are required. The origin defaults to `https://stackstats.dev`, but
set it explicitly to avoid environment drift. Obtain the key from that project's
API settings; do not copy a local-project key. Public variables are embedded in
the client build, so changing them requires a new build/deployment.

Optional, normally **unset** (or literal `[]`):

```dotenv
STACK_STATS_EXTENSION_REDIRECT_URIS=[]
```

Native v0.5.0 callbacks are already allowlisted:

```text
vscode://undefined_publisher.stack-stats-vscode/auth/callback
vscode-insiders://undefined_publisher.stack-stats-vscode/auth/callback
cursor://undefined_publisher.stack-stats-vscode/auth/callback
windsurf://undefined_publisher.stack-stats-vscode/auth/callback
```

A single numeric `windowId` of 1–10 digits is accepted for native window routing.
For a verified remote editor relay, configure its complete exact URI in the JSON
array; no wildcard hosts. A different Marketplace publisher/extension ID also
requires an exact callback update. Do not add broad callback patterns.

No `SUPABASE_SERVICE_ROLE_KEY`, JWT secret, database password, OAuth client secret,
`NEXT_PUBLIC_SITE_URL`, or Vercel URL variable is used by this implementation.
`STACK_STATS_AUTH_ORIGIN` is an extension development-host setting; do not add it
to Vercel. Installed v0.5.0 always uses `https://stackstats.dev`.

Keep the apex domain serving routes directly. The extension rejects HTTP
redirects for exchange, refresh, account, revoke and uploads, so redirecting
`stackstats.dev` to `www` or a Vercel hostname will break it. Keep the default
Next.js route structure; do not add a base path or trailing-slash redirect.

## Exact Supabase auth settings

In the same production project's **Authentication → URL Configuration**:

```text
Site URL:
https://stackstats.dev

Redirect URLs:
https://stackstats.dev/auth/callback?next=/dashboard
https://stackstats.dev/auth/callback?next=**
```

The second pattern is restricted to the exact origin and callback path while
allowing the encoded extension continuation query. Retain the first entry for
ordinary signup. The literal `?` follows Supabase's documented glob syntax;
the application independently validates `next` as a local path. Do not use a
domain-wide production `/**` allowlist. See
[Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Keep the Confirm signup email link pointing to `{{ .ConfirmationURL }}`. Do not
replace it with a hardcoded dashboard or localhost link. The existing server
callback exchanges the returned code (and `sb_flow_id` when present).

Email confirmation may remain enabled or disabled according to the existing
project policy; both paths are supported. If enabled, verify SMTP/delivery and
open the email in the browser that initiated signup so its PKCE cookie exists.
VS Code callbacks are handled by the web app, not by Supabase's redirect list.

For separate local testing, use `STACK_STATS_APP_ORIGIN=http://localhost:3000`
with `npm run dev` and allow the corresponding localhost callback in the test
Supabase project. A production build intentionally rejects an HTTP app origin.
Preview deployments need their own exact origin and a test project's auth
allowlist. An installed v0.5.0 extension cannot target arbitrary preview hosts;
its F5 development override supports loopback only.

## Required migrations and exact deployment order

The original migrations are preserved unchanged:

1. `20260827000000_create_stack_stats.sql` — profiles, languages, manual-save RPC,
   `pgcrypto` in `extensions`.
2. `20260827000100_add_profile_appearance.sql` — existing appearance behavior.
3. `20260909000000_extension_identity.sql` — private codes, connections, access
   tokens, PKCE exchange, identity refresh and revocation.
4. `20260910000000_profile_sync.sql` — scope columns (default identity), rotating
   refresh history, private sync tables, validation, idempotent writes, summaries
   and explicit publication.

There is no fifth migration. The last two are newly restored to this checkout.
They are transactional and additive; they do not update/delete manual profile
values. The scope default preserves existing identity grants. The files are
versioned migrations, **not scripts to rerun against already-created tables**.

Deployment sequence:

1. Review this complete change and confirm the Vercel source repo/root/production
   branch. Keep the old web deployment serving traffic while preparing the DB.
   If pushes to `main` deploy automatically, apply the DB changes before that push.
2. Save the Production environment above and configure Supabase auth URLs/email
   template. Confirm the hosted project's backup/recovery is available. Do not
   run `db reset` or the fixture SQL suites on the hosted database.
3. In Supabase SQL Editor, inspect installed extensions and migration history.
   `pgcrypto` must be in `extensions`; both older profile migrations must already
   be present before applying identity/sync. For this existing production project,
   reconcile the CLI history with the actual schema before a push.
4. Apply only pending migrations in timestamp order. With the Supabase CLI:

   ```bash
   # If this checkout has no supabase/config.toml yet:
   supabase init
   supabase login
   supabase link --project-ref pmzrqkmhdbshuoknyosi
   supabase migration list
   supabase db push --dry-run
   supabase db push
   ```

   If the August migrations were applied manually and their ledger entries are
   absent, verify their exact tables/functions/constraints first, then mark only
   those verified versions applied before the dry run:

   ```bash
   supabase migration repair 20260827000000 20260827000100 --status applied
   ```

   Do not repair the September versions as applied just to suppress errors. If
   they already exist, compare their schema and functions with the files and
   reconcile history explicitly. Alternatively execute each missing SQL file in
   the hosted SQL Editor in order, then reconcile CLI history before future pushes.
   [Supabase migration guidance](https://supabase.com/docs/guides/deployment/database-migrations).
5. Run `supabase/verify-production.sql` in the hosted SQL Editor. It reads schema
   and permissions only. It must pass before deploying the web app. Confirm the
   new functions are visible to PostgREST; if the schema cache is stale, run
   `NOTIFY pgrst, 'reload schema';` and retry. A schema assertion pass is not an
   authenticated E2E pass.
6. Run `npm ci`, `npm test`, `npm run lint`, `npm run build`, and
   `npx tsc --noEmit` on this release. Run `npm run test:db` with Docker for the
   isolated SQL tests. The runner creates/removes its own network-isolated
   PostgreSQL 16 container and never reads hosted credentials.
7. Commit/push or promote this reviewed release using the existing Vercel
   deployment workflow. Use the Next.js preset, `npm ci`, and the existing
   `npm run build`. Ensure it builds the restored implementation and uses the
   Production environment. No extension release is needed.
8. Run `npm run check:production -- https://stackstats.dev`. It checks all route
   methods, unauthenticated failures and callback continuation without approving
   or uploading anything. It must report all passes. It does not certify DB
   writes, mail, credentials or OS deep links.
9. Perform the manual E2E below with an account you control. Release validation
   is complete only when it passes. If the app must be rolled back, keep the
   additive migrations: the previous manual-profile release remains compatible.
   Do not drop sync/credential tables as an application rollback.

## Manual production E2E after deployment

Use installed **v0.5.0**, a native local VS Code window and a writable test
workspace. Keep credentials out of screenshots, logs and pasted console output.

1. Confirm local tracking works while disconnected. Record the test profile's
   existing manual totals/languages and appearance so preservation can be checked.
2. Sign out of `stackstats.dev`. In VS Code Account, choose **Connect account**
   (or **Stack Stats: Connect Stack Stats Account** in the palette). Verify the
   browser opens `https://stackstats.dev/extension/connect?...`, then login with
   the same encoded `next`; no localhost, www or Vercel hostname appears.
3. Log in to an existing account. Verify you return to approval with the correct
   username. The identity consent must say it does not authorize history uploads.
   Choose **Connect VS Code**, allow the browser to open the editor, and verify
   the initiating window shows `@username · Connected`. If the browser blocks the
   launch, use **Return to VS Code** within 90 seconds. Open Profile must open
   `https://stackstats.dev/u/<username>`.
4. Confirm Profile Sync is still disabled and no daily upload occurred from
   identity linking. Verify the public profile still shows the original manual
   data. Reload VS Code and confirm the linked identity restores.
5. Choose **Enable Profile Sync** in VS Code. Verify this opens a second approval
   with `scope=stats:write`, a description of the daily fields and 90-day initial
   history, and a statement that uploads are private. Approve and return to the
   editor; verify sync becomes enabled and queued history drains. For more than
   ten pending dates, allow subsequent batches or repeat **Sync Now**.
6. Make and save edits over at least a minute, allow a session checkpoint, then
   choose **Sync Now**. Check that last success advances and pending days clears.
   Visit `https://stackstats.dev/settings/sync` while signed in and verify private
   totals change. For exact data, open `/api/v1/sync/summary?period=7` in that
   signed-in browser; it must return only your summary. Tiny sessions may round
   to zero whole minutes; edits/lines are useful immediate checks.
7. In a signed-out/private browser, verify the public profile still shows manual
   data. In Sync Privacy enable publication of synced totals, leave languages
   off, and save. Refresh the signed-out profile: totals should reflect synced
   data, its source label should identify synced statistics, and synced languages
   should be hidden. Enable language publication and verify the breakdown appears.
   Appearance, identity, links and saved manual values must remain intact.
8. Choose **Sync Now** again without further edits: totals must not double. Make
   more edits and repeat; that date's new revision must replace its earlier value.
   Disconnect the network, keep editing, and trigger sync. Verify local tracking
   continues and pending work is retained. Reconnect, trigger sync and confirm
   eventual success without duplicate totals.
9. Leave the connection active for over 15 minutes and trigger sync. Verify refresh
   succeeds without another approval, then reload the editor and sync again.
   Test conflicting refresh replay/expired grants with the isolated SQL suite,
   not by exposing production tokens or manually changing production rows.
10. Disable Profile Sync: future uploads stop; existing cloud data/publication
    stays unchanged. Turn publication off on the web: the public profile returns
    to saved manual totals/languages. Re-enable sync if testing revocation next.
11. Visit `/extension/connect` without parameters and disconnect all editors.
    Trigger **Sync Now** or wait for the next identity validation (up to five
    minutes); the editor must require reconnection and stop authorized uploads.
    Local history/tracking must remain intact. Reconnect, then test the editor's
    **Disconnect Account** action online. Offline disconnect removes local
    credentials but cannot confirm server revocation; web revocation handles it.
12. Repeat linking with a new account: switch login → signup using the provided
    link; verify `next` survives. With confirmation enabled, open the confirmation
    email in the initiating browser. Choose a username through existing setup,
    save, then approve the editor connection. With confirmation disabled, signup
    should continue immediately. The editor's pending request expires after ten
    minutes; if email/setup takes longer, restart Connect account.
13. Test **Cancel** in browser and editor, a rejected OS launch, and a duplicate
    old callback. None should link a different account or enable uploads. With a
    second account/browser, confirm summaries and privacy controls address only
    that signed-in account. Cross-account upload/forged-owner denial is also
    covered by the isolated HTTP/SQL tests.

## Verification scope and remaining limitations

Local validation passed: **63 tests in six files**, lint, TypeScript, a production
build with every required route, and **13/13 HTTP smoke checks against that build**
using placeholder Supabase settings and signed-out requests. Exact extension/web
contract parity, four SQL migrations and the identity/sync SQL suites also passed.
The database runner additionally checks upgrading an existing manual profile,
language rows and identity credentials without changing them or adding scope.
SQL tests
exercise PKCE/replay/expiry, hashed storage, rotation/lost-reply recovery,
revocation, scope separation, ownership, version conflicts, quotas, publication,
manual preservation and account deletion. The disposable runner supplies a
minimal Supabase identity schema; it does not simulate the hosted mail service.

Vercel environment values, Supabase dashboard auth settings and the privileged
migration ledger were not accessible from this session. No live credentials were
used for an authenticated browser/editor flow. Complete the rollout before
claiming production E2E is verified.

Existing limits are retained: 90-date initial backfill of durable session data,
ten-date batches, 32 installations/account, 60 PUT attempts/minute/account,
20 active connections/account, ten retained codes per account with ten-minute
cleanup, and
fixed 30-day reconnection. Legacy SQLite-only file history is not converted.
File/session counts across dates are file-days/session-days. Overlapping activity
across collectors is not deduplicated. Remote editor relays require explicit
callback configuration. Disabling sync or revoking credentials does not delete
cloud history or unpublish it. No cloud deletion/export UI is added here.

The public profile deliberately falls back to manual values on a sync RPC error;
use the schema check and private-summary test to detect a missing migration.
This fallback does not expose private telemetry. See [SYNC.md](SYNC.md) and
[EXTENSION_AUTH.md](EXTENSION_AUTH.md) for the retained implementation details.

## Files changed in this workspace

51 files differ from the starting checkout. Most restore the existing `7af2b75`
implementation; the audit corrections and deployment tooling are described above.
The extension and the other web checkout were left untouched.

```text
.env.example
README.md
docs/EXTENSION_AUTH.md
docs/PRODUCTION_AUTH_SYNC.md
docs/SYNC-IMPLEMENTATION.md
docs/SYNC.md
docs/TECHNICAL_OVERVIEW.md
package.json
scripts/check-production.mjs
scripts/test-database.mjs
src/app/api/extension/account/route.ts
src/app/api/extension/authorize/route.ts
src/app/api/extension/exchange/route.ts
src/app/api/extension/refresh/route.ts
src/app/api/extension/revoke-all/route.ts
src/app/api/extension/revoke/route.ts
src/app/api/v1/sync/installations/[installationId]/days/[date]/route.ts
src/app/api/v1/sync/privacy/route.ts
src/app/api/v1/sync/summary/route.ts
src/app/auth/callback/route.ts
src/app/dashboard/page.tsx
src/app/extension/connect/error.tsx
src/app/extension/connect/page.tsx
src/app/login/page.tsx
src/app/settings/sync/page.tsx
src/app/signup/page.tsx
src/app/u/[username]/page.tsx
src/components/auth/auth-form.tsx
src/components/auth/extension-consent.tsx
src/components/dashboard/profile-form.tsx
src/components/dashboard/sync-privacy.tsx
src/components/profile/profile-view.tsx
src/lib/auth-destination.ts
src/lib/extension-api.ts
src/lib/extension-auth.ts
src/lib/sync-api.ts
src/lib/sync-contract.ts
src/lib/synced-profile.ts
src/lib/types.ts
src/proxy.ts
supabase/migrations/20260909000000_extension_identity.sql
supabase/migrations/20260910000000_profile_sync.sql
supabase/tests/extension_identity.sql
supabase/tests/profile_sync.sql
supabase/verify-production.sql
tests/auth-callback.test.ts
tests/auth-continuation.test.tsx
tests/extension-api.test.ts
tests/extension-auth.test.ts
tests/sync.test.ts
vitest.config.mts
```
