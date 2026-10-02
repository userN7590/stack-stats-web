# Marketplace 0.6.0 callback rollout

## Scope and callback identities

The publisher is exactly `StackStats`; the manifest identity is
`StackStats.stack-stats-vscode`, version `0.6.0`. Real VS Code 1.138.0 testing
confirmed that `context.extension.id` retains this case while
`vscode.Uri.toString(true)` serializes the callback authority in lowercase.
The extension release report records that host test. This matches the
[VS Code URI serializer](https://github.com/microsoft/vscode/blob/main/src/vs/base/common/uri.ts),
which lowercases the authority when formatting a URI.

For each existing native scheme (`vscode`, `vscode-insiders`, `cursor`,
`windsurf`), the application permits only these exact callback authorities:

| Authority | Purpose |
| --- | --- |
| `StackStats.stack-stats-vscode` | Canonical release identity |
| `stackstats.stack-stats-vscode` | Observed VS Code serialized release identity |
| `undefined_publisher.stack-stats-vscode` | Temporary beta/VSIX compatibility |

Every native callback requires the literal path `/auth/callback`. It may have
no query, or exactly `?windowId=` followed by 1–10 decimal digits. Other case
variants are rejected. This is a finite allowlist; the input is not lowercased.
Editor schemes other than VS Code retain their existing validation support;
these tests do not establish real browser sign-in support for those products.

Desktop release example (no credentials):

```text
vscode://stackstats.stack-stats-vscode/auth/callback?windowId=1
```

The enclosing browser URL encodes `redirectUri` once, so its nested query
boundary appears as `%3FwindowId%3D1`. After the browser query is parsed, the
validator receives the literal callback above. A callback still containing
`%3FwindowId`, `%253FwindowId`, encoded path separators or encoded query keys is
rejected. The validator compares the raw native base and query rather than
normalizing a URL; dot paths, whitespace/control characters and backslashes
cannot bypass that comparison. Credentials, fragments and preexisting
`code`, `ss_state` or `error` fields are rejected.

`STACK_STATS_EXTENSION_REDIRECT_URIS` retains its existing explicit JSON array
of extra trusted callback strings. Extras match exactly and do not gain a
`windowId` wildcard. Keep it unset or `[]` unless a separately verified remote
editor relay needs it. An environment-only publisher update cannot replace
this code deployment for desktop callbacks with changing window IDs.

## Legacy removal

Legacy sign-in remains available during the beta-to-Marketplace transition so
existing VSIX users can upgrade deliberately. This does not migrate their
editor storage or secrets. They should follow the extension release migration
guide and sign in again with the Marketplace identity.

- Review beta upgrades during Phase 10C.
- Remove `undefined_publisher.stack-stats-vscode` from `nativeRedirects` and
  its positive test matrix before the next Marketplace minor release, after
  confirming the known beta users have upgraded. Replace those tests with
  rejection tests and announce the cutoff to those users.
- If that deadline must move, record the owner, reason and new deadline here;
  do not silently retain the legacy authority indefinitely.
- Keep the two proven release spellings; never replace them with a wildcard
  or case-insensitive publisher match.

## State, PKCE and Supabase

**Supabase change required: no.** The publisher change does not alter the web
origin, `/auth/callback`, email confirmation continuation or database schema.
Supabase returns to the website; the website issues the editor's short code.
Keep the existing production Supabase redirect configuration documented in
[PRODUCTION_AUTH_SYNC.md](PRODUCTION_AUTH_SYNC.md). No native editor URI needs
to be added to Supabase's redirect list. Hosted settings were not changed.

The existing security boundary remains:

1. Browser approval requires an exact application Origin and a fresh
   authenticated Supabase user. The connection page and authorize/exchange
   endpoints all validate the callback.
2. The extension generates its pending state and S256 verifier. Only the
   challenge and state go through the browser. A callback returns `ss_state`
   and a short code (or `error=access_denied`), preserving `windowId`.
3. The extension checks the pending state; the database consumes a 90-second
   code only once, with an exact complete redirect URI and matching S256
   verifier. The verifier and access/refresh tokens never enter callback URLs.
4. Account linking does not grant `stats:write` or publish metrics. Sync
   consent, capability negotiation, refresh and website publication controls
   remain unchanged.

The tests exercise release and legacy schemes, one-level browser encoding,
wrong/look-alike publishers, extension names, arbitrary domains, mixed case,
malformed queries, duplicate fields, double encoding, normalization attempts,
callback construction, HTTP approval/exchange and login/signup continuation.

Validation in the production source checkout on 2026-10-01 (targeted, full
suite, lint, `tsc` and build re-run on 2026-10-02 with identical results):

- Targeted auth tests: 56 passed; full suite: 755 passed across 21 files.
- ESLint, production build, `npx tsc --noEmit` and `git diff --check`: passed.
- Production build used placeholder Supabase settings. All 13 unauthenticated
  HTTP smoke checks passed against that build on loopback, including the
  lowercase Marketplace callback with `windowId`.
- `npm run test:db` could not start: the configured Colima Docker socket did
  not exist. The disposable database suite needs a running local Docker
  daemon; no hosted database was used instead.
- Deployment and real authenticated browser/editor sign-in remain pending.

## Review, commit and deploy

Use the production source checkout:

```bash
cd /Users/fstopyra/Desktop/stack-stats/stack-stats-web
npm test -- tests/extension-auth.test.ts tests/extension-api.test.ts tests/auth-callback.test.ts tests/auth-continuation.test.tsx
npm test
npm run lint
npm run build
npx tsc --noEmit
git diff --check
git add -- src/lib/extension-auth.ts tests/extension-auth.test.ts tests/extension-api.test.ts tests/auth-callback.test.ts tests/auth-continuation.test.tsx scripts/check-production.mjs docs/EXTENSION_AUTH.md docs/PRODUCTION_AUTH_SYNC.md docs/MARKETPLACE_AUTH_060.md
git commit -m "Allow Marketplace extension callbacks with strict window routing"
```

The change does not modify `src/lib/distribution.ts` or set
`VSCODE_EXTENSION_URL`. No database migration, environment edit, privacy page
or favicon change is part of this deployment.

**Human deployment checkpoint:** no commit, push or deployment is performed by
this preparation. In Vercel, open the project serving `stackstats.dev` and check
Settings → Git: it must use `userN7590/stack-stats-web` and the intended production
branch. This checkout is on `main`; the Vercel linkage/production branch is not
available in local project metadata. Once the owner confirms `main` is the
production branch and explicitly approves deployment:

```bash
git push origin main
```

In that Vercel project's Deployments tab, verify the reviewed commit reaches
**Ready** in **Production** and is assigned to `stackstats.dev`. If automatic
production deployment is disabled, use **Create Deployment**, enter the reviewed
commit SHA and choose the production branch configuration if prompted. Verify
the resulting deployment uses **Production** and the expected domain. Do not
redeploy an older commit. Preserve the existing Production environment and
Supabase setup. See [Vercel's Git deployment instructions](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference).

After it is Ready:

```bash
npm run check:production -- https://stackstats.dev
```

The smoke command now sends the actual lowercase Marketplace callback and
requires the full native callback, including `windowId`, to survive login
continuation. It makes only unauthenticated requests and does not approve or
upload data. A passing probe is still not a real sign-in test.

## Required browser/editor checkpoint

After the owner deploys the web commit, use the audited 0.6.0 VSIX in the clean
VS Code profile. Connect through the real browser and `stackstats.dev`, approve
the account, verify return to the initiating window, identity restoration,
Open Profile, refresh after expiry, disconnect and reconnect. Then approve
private sync separately, verify retries and capability negotiation, and verify
that publication remains unchanged. Keep credentials out of logs and reports.

The Marketplace upload must wait for this authenticated checkpoint and the
privacy policy requirement recorded in the extension release report. Rollback
of this web commit removes release-identity sign-in support; temporary legacy
callbacks stay supported. Do not work around a failed rollout by broadening
the redirect allowlist.
