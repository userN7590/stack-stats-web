# Stack Stats

Stack Stats is a small public-profile app for developers. After signing in, a
developer can manually enter aggregate coding statistics, maintain a language
breakdown, and share a responsive profile at `/u/[username]`.

The app does not read source code or track activity automatically.

## Stack

- Next.js 16 with the App Router, TypeScript, Tailwind CSS, and ESLint
- Supabase Auth and Postgres with cookie-based SSR sessions
- Supabase Row Level Security for all browser-accessible data
- Zod validation and Lucide icons

## Local setup

You need Node.js 20.9 or newer, npm, and a Supabase project.

1. Install packages:

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. In the Supabase dashboard, open **Project Settings → API** (or the project
   Connect dialog) and add the project URL and anonymous/publishable browser key
   to `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```

   Never add the service-role key. The browser key is intentionally public; RLS
   provides data authorization.

4. Apply the database migration in
   `supabase/migrations/20260827000000_create_stack_stats.sql`.

   With the Supabase CLI installed separately and the project linked:

   ```bash
   supabase db push
   ```

   Or paste the migration into the Supabase SQL Editor and run it once.

5. In **Authentication → URL Configuration**, set:

   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
   - Add `https://your-production-domain/auth/callback` before deploying.

   Email/password authentication is enabled by default on hosted Supabase
   projects. Hosted projects also require email confirmation by default, so a
   working email delivery configuration is needed for signup confirmation.

6. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). A static example profile
   is available at `/example` without Supabase data.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The production build does not need real Supabase values because database-backed
routes are rendered at request time. Those routes still require the two
environment variables when they are visited.

## Project structure

```text
src/
  app/                    App Router pages, callback route, loading/error states
  components/             Auth, dashboard, profile, and shared UI
  lib/supabase/           Browser client, server client, and session refresh logic
  lib/validation.ts       Zod schemas shared by forms
  proxy.ts                Next.js 16 session-refresh proxy
supabase/migrations/      Versioned database schema, transaction, and RLS policies
```

Profile saves use a small `security invoker` Postgres function so the profile and
its language rows update in one transaction. It derives the owner from
`auth.uid()` and continues to enforce the table RLS policies.

## Deployment

For Vercel, add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project environment, add the deployed
callback URL to Supabase's redirect allow list, apply the migration to the
production Supabase project, and deploy normally.

## Intentional MVP limits

- Statistics and percentages are manually entered and profile-owner reported.
- Avatars use external HTTPS URLs; the app does not provide file uploads.
- There is no extension, CLI, automatic tracking, source ingestion, GitHub data
  import, social graph, payment system, theming, or advanced analytics.
- Automated browser/database integration tests are not included; lint,
  TypeScript, production build, and manual Supabase flow checks are the current
  verification path.
