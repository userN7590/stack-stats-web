# Stack Stats

Stack Stats is a public developer-profile application for manually entered coding
statistics and optional daily summaries from the local-first VS Code extension.
Developers can publish an identity and links, maintain development totals and a
language breakdown, and share a profile at `/u/[username]`.

The web app does **not** read source code or ingest repositories. Extension
uploads require separate consent, stay private by default, and only appear on a
public profile when its owner enables publication. Manual profile data remains
supported.

- **Live application:** [https://stackstats.dev](https://stackstats.dev)
- **Public example profile:** [https://stackstats.dev/u/fil](https://stackstats.dev/u/fil)
- **Technical discussion:** [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md)
- **Production auth/sync rollout:** [exact v0.5.0 deployment and E2E checklist](docs/PRODUCTION_AUTH_SYNC.md)

## Features

- Email/password signup, login, confirmation callback support, and logout
- Cookie-backed Supabase sessions across browser and server rendering
- First-time profile setup followed by section-specific editing
- Public identity, biography, avatar URL, GitHub URL, and personal website
- Aggregate lines, files, edits, projects, and coding-time statistics
- Validated language percentage distributions
- Public, responsive profiles with owner-only contextual edit controls
- Five constrained display-font presets and five subtle background presets
- Authentication-aware landing navigation and a live `/u/fil` profile preview
- Loading, validation, empty, error, and not-found states

## Optional VS Code account linking

The existing Supabase login/signup and profile setup now support a secure editor approval flow at `/extension/connect`. It returns a single-use, S256 PKCE-bound code to VS Code, then exchanges it for identity-only device credentials over HTTPS. Browser Supabase tokens are never put in the editor callback. Connecting alone does not upload telemetry. A separate stats:write approval enables private daily aggregates; see [optional aggregate synchronization](docs/SYNC.md).

Apply `supabase/migrations/20260909000000_extension_identity.sql` after the existing migrations. It adds private hash-only grant/device/access tables and narrowly scoped functions; no service-role key is needed. Existing profiles/statistics are preserved. Set `STACK_STATS_APP_ORIGIN` to the exact application origin (production defaults to `https://stackstats.dev`; local development uses `http://localhost:3000`). Optional `STACK_STATS_EXTENSION_REDIRECT_URIS` is a JSON array of additional exact trusted editor callback URIs. See [extension authentication architecture and F5 testing](docs/EXTENSION_AUTH.md) for callback/email configuration, database tests, lifetimes, revocation, and security tradeoffs.

Logged-in users can visit `/extension/connect` without query parameters to revoke all editor connections. This is independent of browser logout and does not delete accounts or local editor history.

## Technology stack

- Next.js 16 App Router and React 19
- TypeScript with strict checking
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, and Row Level Security
- `@supabase/ssr` for cookie-backed browser/server sessions
- Zod for client-side input validation
- Recharts for the language visualization
- Lucide React icons
- Vitest for focused unit tests
- ESLint with the Next.js configuration

## Architecture summary

App Router pages are Server Components by default. Public pages read profile
data through the anonymous Supabase key and public RLS policies. Session-aware
pages use the existing server client, which reads Supabase cookies without
exposing credentials. Interactive forms are Client Components and use the
browser Supabase client for authenticated writes.

`src/proxy.ts` refreshes cookie-backed sessions and redirects unauthenticated
requests away from `/dashboard`. The dashboard performs its own server-side
claim check as defense in depth. Public profile routes never require a session;
when one exists, the server compares the trusted claim subject with
`profiles.user_id` before rendering owner controls.

Profile and language updates use the `save_profile` PostgreSQL function. It
derives the owner from `auth.uid()` and updates the profile plus its language
rows in one transaction. Appearance settings use a separate, narrowly scoped
`update_profile_appearance` function. Both are `security invoker` functions, so
the existing grants and RLS policies continue to apply.

## Database model

### `profiles`

One row per authenticated user, keyed by `user_id` referencing `auth.users`.
It stores the unique username, public identity and links, six non-negative
aggregate statistics, the controlled `display_font` and `background_style`
values, and creation/update timestamps.

### `profile_languages`

Zero to twelve language rows per profile. Each row stores a language name and
percentage. Names are unique per user without regard to case. Application
validation requires supplied language percentages to total 100%.

The versioned schema lives in:

```text
supabase/migrations/20260827000000_create_stack_stats.sql
supabase/migrations/20260827000100_add_profile_appearance.sql
supabase/migrations/20260909000000_extension_identity.sql
supabase/migrations/20260910000000_profile_sync.sql
```

Apply pending migration files in timestamp order. The appearance migration preserves existing
profiles by adding safe `editorial` and `none` defaults.

## Authentication and authorization

The application uses only the Supabase project URL and anonymous/publishable
key. It does not use or require the service-role key.

RLS allows anyone to read profiles and language rows. Authenticated users may
insert, update, or delete only rows whose `user_id` matches `auth.uid()`.
Database constraints provide a second validation layer for usernames, URLs,
non-negative totals, language values, and appearance presets.

Signup supports both Supabase email configurations:

- When confirmation is disabled and signup returns a session, the user enters
  the application immediately.
- When confirmation is enabled and signup returns a user without a session, the
  interface asks the user to check their email. The callback exchanges the
  authorization code and sends the confirmed user to the dashboard.

Email confirmation was disabled in the hosted assessment environment to
minimize reviewer friction. The confirmation callback remains implemented and
supports projects where email confirmation is enabled.

## Local prerequisites

- Node.js 20.9 or newer
- npm
- A Supabase project
- Optional: Supabase CLI for migration deployment

## Local setup

1. Clone and install:

   ```bash
   git clone https://github.com/userN7590/stack-stats-web.git
   cd stack-stats-web
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Create a Supabase project. In **Project Settings → API**, copy the project
   URL and anonymous/publishable key into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   STACK_STATS_APP_ORIGIN=http://localhost:3000
   ```

   Never place the service-role key, database password, or other private
   credentials in this application. `.env.local` is ignored by Git.

4. Apply the migrations. With a linked Supabase CLI project:

   ```bash
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ```

   Alternatively, open **SQL Editor** in the Supabase dashboard and run the
   files from `supabase/migrations` in filename order.

5. In **Authentication → URL Configuration**, configure:

   ```text
   Site URL (local project): http://localhost:3000
   Site URL (production project): https://stackstats.dev

   Redirect URL: http://localhost:3000/auth/callback?next=/dashboard
   Redirect URL: https://stackstats.dev/auth/callback?next=/dashboard
   Redirect URL: http://localhost:3000/auth/callback?next=**
   Redirect URL: https://stackstats.dev/auth/callback?next=**
   ```

   Use the Site URL appropriate to the project/environment and include both
   callback URLs when the same Supabase project is used for local and production
   testing. For Vercel previews, add an appropriately scoped preview redirect
   pattern. If email confirmation is enabled, keep the Confirm signup email
   template linked through `{{ .ConfirmationURL }}`.

6. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Testing and verification

Run the focused unit suite:

```bash
npm test
npm run test:db # Docker; creates and removes an isolated database
```

Run the static and production checks:

```bash
npm run lint
npm run build
npx tsc --noEmit
```

The tests import the production Zod schemas and formatting utilities directly.
They cover valid and invalid profile data, language distributions, appearance
presets, coding-time formatting, and related formatting edge cases.

## Optional Vercel deployment

Follow the [production rollout checklist](docs/PRODUCTION_AUTH_SYNC.md): configure
the hosted project variables and auth redirects, apply pending migrations and
verify permissions, then deploy the web release. Apply the database changes
before pushing to an automatically deployed production branch. After deployment
run `npm run check:production` and the documented browser/editor E2E test.
No service-role credential or custom server is required.

## Known limitations

- Manual statistics remain supported. Optional editor daily summaries are self-reported collector data, with separate private-upload and public-publication consent. No source-code access or repository ingestion occurs.
- Manual statistics are current totals. Optional synced daily records support private 7/30/90-day and lifetime queries; cross-device overlapping work cannot yet be deduplicated.
- Avatars use external HTTPS URLs; there is no image upload pipeline.
- Authentication is email/password only. Password recovery and social OAuth are
  not part of this MVP.
- Automated tests cover validation, formatting, auth, sync endpoints and publication precedence. Disposable SQL suites verify PKCE, rotation, ownership, revisions, privacy and aggregation. Full browser account linking still needs staging E2E verification.
- Appearance is intentionally limited to curated presets rather than arbitrary
  CSS, colors, fonts, images, or executable content.

## Future improvements

- Cloud deletion/export, granular publication controls and sync staging E2E coverage
- Historical trends and expanded analytics
- OAuth and social login
- Managed avatar/image uploads
- Password recovery, email preference, and notification improvements
- Browser E2E tests and Supabase integration tests in a separate staging project

## Optional aggregate synchronization

Apply `supabase/migrations/20260910000000_profile_sync.sql` after the existing identity migration. No service-role key or manual-profile rewrite is needed. Existing identity grants remain unchanged; new stats:write grants require browser approval and use recoverable refresh-token rotation. Daily PUTs derive the owner from credentials and are idempotent by account/installation/date/revision.

Uploads stay private. `/settings/sync` explicitly selects whether synced lifetime totals replace the displayed manual profile and whether synced languages are public. Project aliases and historical dates are private. Owners can inspect `GET /api/v1/sync/summary?period=7|30|90|lifetime` with the existing browser session. Upload credentials cannot edit publication, identity or manual profile data.

The new schema has private `sync_installations`, `sync_days`, `sync_privacy`, `sync_rate_limits` and refresh-token history tables. It enforces strict daily field/counter/size constraints, quota and revision rules in PostgreSQL as well as HTTP validation. SQL fixtures are in `supabase/tests/profile_sync.sql` and `supabase/tests/extension_identity.sql`; use a disposable migrated DB only.

See [SYNC.md](docs/SYNC.md) for exact payload, routes, consent, 90-day initial history, retry behavior, multi-device limits, security details, F5 staging procedure, benchmark and next steps. The contract in `src/lib/sync-contract.ts` is an exact vendored copy of the extension protocol package; update both together and run the parity checker documented there.
