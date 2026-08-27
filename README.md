# Stack Stats

Stack Stats is a public developer-profile application for presenting manually
entered, self-reported aggregate coding statistics. Developers can create an
account, publish an identity and links, maintain development totals and a
language breakdown, and share a responsive profile at `/u/[username]`.

Stack Stats does **not** read source code, ingest repositories, or automatically
track development activity. Profile owners decide which aggregate values to
enter and make public.

- **Live application:** [https://stackstats.dev](https://stackstats.dev)
- **Public example profile:** [https://stackstats.dev/u/fil](https://stackstats.dev/u/fil)
- **Technical discussion:** [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md)

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
```

Apply both files in timestamp order. The second migration preserves existing
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
   ```

   Never place the service-role key, database password, or other private
   credentials in this application. `.env.local` is ignored by Git.

4. Apply the migrations. With a linked Supabase CLI project:

   ```bash
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ```

   Alternatively, open **SQL Editor** in the Supabase dashboard and run both
   files from `supabase/migrations` in filename order.

5. In **Authentication → URL Configuration**, configure:

   ```text
   Site URL (local project): http://localhost:3000
   Site URL (production project): https://stackstats.dev

   Redirect URL: http://localhost:3000/auth/callback?next=/dashboard
   Redirect URL: https://stackstats.dev/auth/callback?next=/dashboard
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
```

Run the static and production checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The tests import the production Zod schemas and formatting utilities directly.
They cover valid and invalid profile data, language distributions, appearance
presets, coding-time formatting, and related formatting edge cases.

## Optional Vercel deployment

1. Push the repository to GitHub and import it into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the required Vercel environments.
3. Apply both migrations to the production Supabase project.
4. Set the Supabase Site URL to the production domain and allow the production
   callback URL shown above.
5. Deploy. No service-role credential or custom server is required.

## Known limitations

- All coding statistics are manual and self-reported; there is no source-code
  access, repository ingestion, or automatic tracking.
- Statistics represent current aggregate totals, not historical snapshots.
- Avatars use external HTTPS URLs; there is no image upload pipeline.
- Authentication is email/password only. Password recovery and social OAuth are
  not part of this MVP.
- The automated suite covers pure validation and formatting logic. It does not
  currently include browser E2E tests or isolated Supabase integration tests.
- Appearance is intentionally limited to curated presets rather than arbitrary
  CSS, colors, fonts, images, or executable content.

## Future improvements

- A Stack Stats CLI and VS Code extension
- Privacy-conscious automatic collection of aggregate statistics without source
  content ingestion
- Historical trends and expanded analytics
- OAuth and social login
- Managed avatar/image uploads
- Password recovery, email preference, and notification improvements
- Browser E2E tests and Supabase integration tests in a separate staging project
