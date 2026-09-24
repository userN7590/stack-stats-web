# Stack Stats: Technical Overview

For the current extension v0.5.0 production path, see the
[production auth/sync audit and deployment checklist](PRODUCTION_AUTH_SYNC.md).
The assessment discussion below describes the original manual-profile baseline.

## Problem and product concept

Developer work is difficult to summarize in one public, readable place. Source
hosts show repositories and contribution activity, while portfolios typically
focus on finished projects. Stack Stats explores a narrower product concept: a
developer can publish the aggregate coding statistics they already trust, add a
short identity and language breakdown, and share one responsive profile URL.

The current product is deliberately honest about its data source. Statistics
are entered manually and are self-reported. Stack Stats does not read source
code, connect to repositories, or automatically monitor development activity.
That boundary reduces privacy risk and kept the assessment focused on a
complete account-to-public-profile workflow.

## Assessment scope and prioritization

This repository was built as a time-boxed Full Stack II assessment. The
implementation prioritizes a coherent MVP over breadth: email/password access,
protected profile management, public profiles, database authorization,
validation, responsive presentation, and deployment readiness. Features such
as a CLI, editor extension, historical analytics, social functionality,
payments, and source ingestion were intentionally excluded.

The resulting flow is small but complete. A visitor can understand the product
from the landing page and its live `/u/fil` preview. A developer can create an
account, establish an identity, add links and aggregate statistics, maintain a
language distribution, choose a controlled appearance, and share
`/u/[username]`. The public profile doubles as the owner's management overview;
authenticated owners receive contextual links into section-specific editors.

## Next.js and TypeScript architecture

The application uses Next.js 16 with the App Router and strict TypeScript. Pages
remain Server Components unless they require browser interaction. The landing
page, dashboard, example route, and `/u/[username]` route compose data and UI on
the server. Authentication and editing forms are Client Components because they
manage input state and call the browser Supabase client.

The main areas are:

```text
src/app/                    Routes, metadata, loading/error boundaries, callback
src/components/auth/        Login, signup, logout, and auth presentation
src/components/dashboard/   Section-specific profile and appearance forms
src/components/profile/     Public profile, avatar, chart, and background presets
src/components/ui/          Shared centered navbar and logo
src/lib/supabase/           Browser/server clients and session proxy logic
src/lib/validation.ts       Production Zod schemas
src/lib/format.ts           Pure display-formatting utilities
supabase/migrations/        Versioned PostgreSQL schema, functions, grants, RLS
tests/                      Focused unit tests against production logic
```

Dynamic pages use the cookie-aware server Supabase client. The landing page
reads the current session to select the correct navigation and CTA without
client-side authentication flicker. It also loads the actual public `fil`
profile and falls back without crashing if that preview is unavailable.

## Supabase and PostgreSQL persistence

Supabase supplies PostgreSQL storage and email/password authentication. The
application uses only `NEXT_PUBLIC_SUPABASE_URL` and the anonymous/publishable
key. Authorization is not based on hiding that browser key; it is enforced by
PostgreSQL grants and Row Level Security.

The `profiles` table uses `auth.users.id` as its primary key. It contains the
unique username, optional identity and links, six non-negative aggregate
statistics, two constrained appearance values, and timestamps. The
`profile_languages` table contains a UUID primary key, owner ID, language name,
percentage, and creation time. A foreign key cascades language deletion when a
profile or auth user is removed. An index supports profile-language reads, and
a case-insensitive unique index prevents duplicate language names per owner.

The appearance migration adds `display_font` and `background_style` with safe
defaults. Check constraints permit only the five known values for each setting.
Existing rows receive `editorial` and `none`, so the migration is backward
compatible with profiles created before appearance customization existed.

## Authentication, SSR sessions, and authorization

`@supabase/ssr` creates browser and server clients around the same publishable
key. The server client reads request cookies. `src/proxy.ts` delegates to the
session-refresh logic, copies refreshed cookies to the response, and redirects
unauthenticated dashboard requests to `/login`. The dashboard repeats the claim
check before reading owner data, so route protection does not depend solely on
the proxy matcher.

Signup handles both supported Supabase configurations. If `signUp` returns a
session, navigation proceeds immediately. If it returns a user without a
session, the form displays a confirmation-email state. Confirmation links enter
`/auth/callback`, where the code is exchanged for a session. The callback only
accepts same-origin relative `next` destinations and otherwise falls back to
`/dashboard`; failures return a non-sensitive login error.

The hosted assessment disables email confirmation to reduce reviewer friction,
but the confirmation flow remains functional for projects that enable it.

RLS permits anonymous and authenticated reads of both public tables. Insert,
update, and delete policies require `auth.uid()` to match `user_id`. Owner-only
controls on `/u/[username]` are decided server-side by comparing the trusted
session subject with the profile owner ID. The public route itself never
requires authentication, so signed-out visitors and other users see the same
profile without edit controls.

## Atomic profile persistence

The profile editor is split into identity, links, totals, and language sections,
but the original persistence contract accepts a complete profile. Before a
section save, the client combines edited values with the server-loaded unchanged
values and validates the complete object.

The `save_profile` PostgreSQL function performs the profile upsert, language
replacement, and language insertion inside one database transaction. It does
not accept a user ID from the browser; it derives ownership from `auth.uid()`.
Because it is `security invoker`, the caller's grants and RLS rules still apply.
This prevents the partially updated profile/language state that separate browser
requests could create.

Appearance uses a second, deliberately narrow function. It updates only the two
appearance columns for `auth.uid()` and independently rejects values outside the
curated allow lists. The original full-profile function does not update those
columns, so ordinary profile edits preserve the selected appearance.

## Validation and error handling

`profileSchema` is the client-side source of truth for profile input. It
normalizes usernames, constrains their format and length, validates HTTP(S)
URLs, requires non-negative integer aggregates, limits language rows, rejects
case-insensitive duplicate language names, validates each percentage, and
requires a supplied distribution to total 100%. `appearanceSchema` accepts only
the fixed font and background identifiers.

Forms map Zod issues to accessible field-level messages and retain input when
validation fails. Supabase errors are surfaced through restrained form-level
feedback, with special handling for username conflicts and a missing appearance
migration. Routes use loading boundaries, focused error boundaries, and proper
not-found states. PostgreSQL constraints repeat critical guarantees so writes
cannot bypass them by calling the API directly.

## Public and protected routes

- `/` is public and session-aware. It renders the appropriate CTA and a live
  public example preview.
- `/login` and `/signup` are public authentication routes.
- `/auth/callback` exchanges confirmation codes and establishes the cookie
  session.
- `/dashboard` is protected. New users see setup; existing users are redirected
  to their public profile unless a valid editor section is selected.
- `/u/[username]` is always public. Ownership only adds contextual controls.
- `/example` is a static fallback demonstration profile.

## Responsive design and accessibility

The UI uses a warm-black visual system, restrained blue accent, shared centered
navigation, readable line lengths, and responsive grid/stack transitions. The
landing page is intentionally compact: a centered statement, auth-aware actions,
and a real profile preview rather than multiple marketing sections.

Forms use semantic labels, fieldsets, legends, native radio controls, keyboard
focus rings, minimum touch-target sizing, `aria-invalid`, described errors, and
live status regions. Public links are ordinary anchors with clear focus states.
Decorative atmosphere elements are pointer-inert and hidden from assistive
technology. Mobile layouts avoid horizontal overflow, and reduced-motion CSS
removes nonessential transitions for users who request it.

## Appearance presets

Appearance customization is intentionally controlled. Five display-font stacks
and five background atmospheres are selected by identifier. The editor previews
the current unsaved font and background together and uses the same background
component as the public page, with a stronger editor-only preview mode. Public
effects remain subtle so text contrast and profile content stay primary.

Arbitrary CSS, colors, font names, URLs, and background code are prohibited.
That decision avoids stored styling injection, broken responsive layouts,
unreadable profiles, unpredictable asset requests, and a much larger moderation
and compatibility surface.

## Testing and verification

Vitest exercises production schemas and utilities rather than copied rules. The
suite covers valid profile data, rejected username formats, normalization,
negative totals, language bounds and totals, duplicate languages, every curated
appearance preset, unsupported appearance values, coding-time formatting,
number formatting, initials, hostname handling, and date handling.

The final verification workflow is:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
npm audit
```

These checks complement manual testing against Supabase. The current unit suite
does not emulate the browser confirmation flow, cookie refresh, PostgreSQL RLS,
or transaction behavior.

## Tradeoffs and known limitations

The MVP favors direct code and a small component hierarchy over a generalized
form framework or repository layer. The complete-payload save contract is easy
to understand and atomic, although concurrent edits in multiple browser tabs
could overwrite values loaded by the older tab. Language updates replace the
owner's current set instead of maintaining per-row edit history.

Statistics are present-state aggregates and have no history. Avatar images are
external URLs. There is no password-recovery UI, OAuth, image upload service,
background job system, notification preference center, browser E2E suite, or
separate test database. Public profiles are intentionally public by policy.

For a longer project, work would move through short-lived feature branches and
pull requests with required review and CI checks. Each pull request would have a
Vercel preview deployment. Supabase schema changes would be tested against a
separate testing/staging project before production, with integration tests for
RLS and database functions and browser tests for authentication redirects and
the main profile workflow.

## Future work

The clearest product expansion is a Stack Stats CLI and VS Code extension that
can produce privacy-conscious aggregate totals without uploading source code.
Automatic collection would need explicit consent, inspectable aggregation, local
processing where possible, clear exclusions, and a design that never requires
raw source ingestion.

Additional future work includes historical snapshots and trend analytics,
OAuth/social login, managed image uploads, password recovery, improved email and
notification flows, richer export options, and broader automated integration
coverage.


## Optional editor identity delegation

The existing Supabase authentication and profile model now support VS Code account linking through `/extension/connect` and `/api/extension/*`. This is identity-only authorization; manually entered statistics and their write policies are unchanged. Read [EXTENSION_AUTH.md](EXTENSION_AUTH.md) for the protocol, SQL grants/RLS, credential lifetimes, tests, and deployment requirements.
