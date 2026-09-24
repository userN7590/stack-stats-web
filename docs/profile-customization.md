# Profile customization foundation

The profile keeps its existing identity, appearance, manual/synced data selection,
and publication behavior. A separate versioned layout controls how its existing
content is presented. It contains no telemetry, private language data, or URLs.

## Model and presentation

`src/lib/profile-layout.ts` owns module definitions, the strict version 1 save
schema, defensive read normalization, defaults, and immutable editing operations.
`src/lib/profile-metrics.ts` adapts the profile's already-selected data into named
headline metrics. `src/components/profile/profile-modules.tsx` registers the
presentations. A future presentation can use the same metric adapter without
changing sync payloads or requiring users to select an internal data source.

Available sections are Links, Headline stats, Code changes, and Languages. The
default order follows the existing profile: links, all six totals, code changes,
then language activity. Every section starts visible and full width; sections
without published content remain subject to the public renderer's empty-state
rules. Links, Code changes, and Languages also support half width on larger
screens; every section stacks on narrow screens. Headline stats remains full
width and permits one through six selected cards in the owner's chosen order.

Supported metric IDs are `lines_added`, `lines_removed`, `files_changed`,
`edit_events`, `projects_count`, and `coding_minutes`. Labels come from the data
adapter so synced aggregates keep their existing semantics. There are no new
session, streak, or inferred metrics.

Example default configuration:

```json
{
  "version": 1,
  "modules": [
    { "type": "links", "visible": true, "size": "full" },
    {
      "type": "stats",
      "visible": true,
      "size": "full",
      "stats": [
        "lines_added", "lines_removed", "files_changed",
        "edit_events", "projects_count", "coding_minutes"
      ]
    },
    { "type": "code_changes", "visible": true, "size": "full" },
    { "type": "languages", "visible": true, "size": "full" }
  ]
}
```

Missing/NULL configuration and unsupported versions render the default layout.
The editor refuses to overwrite an unsupported version. Recoverable version 1
configurations are normalized in memory: unknown/duplicate modules and invalid
stats are discarded, missing sections are added hidden, invalid sizes fall back
to full width, and an unusable/fully hidden configuration falls back to defaults.
Reading never rewrites stored configuration. New saves are strict and canonical:
each of the four known sections appears exactly once, at least one stays visible,
and selected stats are unique. Hiding a section preserves its size and stat
selection for restoration.

## Editing flow

The owner opens `/u/<username>?customize=1` through Customize profile. The server
checks the authenticated profile owner before enabling the editor; adding the
query to another profile never exposes controls. The existing identity and
appearance remain visible while the owner works directly on the profile sections.
Each section has Up, Down, and Hide controls. Move buttons work with pointer,
touch, and keyboard; no drag-and-drop dependency is needed. Changes are announced
to assistive technology, and hide/restore and stat removal manage keyboard focus.
Add section lists only hidden sections, so duplicate sections cannot be created.
Width buttons and the expandable Choose stats panel update the same shared
renderer immediately. Four selected stats use two columns; other counts adapt
without requiring exactly three cards.

Preview removes editing controls and uses the visitor's empty-content rules.
Empty Links and unpublished Languages never reveal hidden or manual fallback
data. If a custom layout selects only sections with no available content, visitors
see a neutral empty state. Hiding controls presentation, not publication; Sync
settings stays separate and manages the existing privacy choices.

Save layout validates and writes only `p_layout` through the new RPC, then returns
to the profile. Cancel discards the draft without writing. Reset layout changes
only the draft and requires Save to apply. Save errors retain the draft for retry;
controls lock during saving. Unsaved drafts prompt before browser unload and
ordinary link navigation. Profile details and Appearance link to the existing
edit pages. No new charts, telemetry, or customization dependencies are added.

Future module types should add a versioned config/parser transition, data adapter
as needed, registry entry, and matching database validator migration. Keep the
data/publication boundary upstream of rendering. Unknown future layout versions
render safely and cannot be overwritten by this version's editor.

## Database contract

The additive migration is
`supabase/migrations/20260924000000_profile_layout.sql`, following the four existing
migrations. It adds:

- `public.profiles.profile_layout jsonb`, nullable with a NULL default. NULL is an
  intentional application-default sentinel. There is no data backfill.
- `public.profile_layout_is_valid(jsonb)`, an immutable pure validator, and
  `profiles_profile_layout_check`. Both direct owner writes and RPC saves must
  satisfy the same version, allowed fields, unique modules, visibility, sizes,
  and stat-selection requirements. SQL NULL is permitted; JSON `null` is invalid.
- `public.update_profile_layout(p_layout jsonb) returns void`, a security-invoker
  RPC available only to `authenticated`. It derives ownership from `auth.uid()`;
  there is no caller-supplied owner ID. It updates only layout, respects existing
  RLS, locks the owner's existing row, and skips no-op writes. SQL NULL resets the
  saved configuration to the app default. Errors are `42501` for missing identity,
  `22023` for invalid configuration, and `P0002` for a missing profile.
- `public.set_profile_updated_at()`, used by the existing profiles timestamp
  trigger. A layout-only change preserves `updated_at`, so old manual totals do
  not appear freshly updated after rearranging sections. Other profile writes
  retain existing timestamp behavior. The original generic `set_updated_at()`
  function is left intact.

Existing profile SELECT permissions expose this presentation-only configuration
to public readers. RLS policies and table grants do not change. The pure validator
is executable by authenticated owners because their direct writes invoke the
CHECK constraint; it reads no records. Anonymous users cannot execute the save
RPC or write profiles. There are no changes to sync/auth APIs, private sync tables,
account linking, publication settings, manual-save RPCs, or appearance RPCs.
Existing manual/appearance forms omit the new column and therefore preserve it.

## Validation and manual verification

Run the normal web checks from the repository root:

```bash
npm test
npm run lint
npx --no-install tsc --noEmit
npm run build
git diff --check
npm run test:db
```

The database harness creates its own disposable, network-isolated PostgreSQL 16
Docker container, applies migrations there, runs transactional fixtures, and
removes the container. It does not read hosted credentials. Docker must be running.
`supabase/tests/profile_layout.sql` exercises real `authenticated`/`anon` roles,
strict RPC and direct-write validation, cross-owner RLS, public reads, NULL
defaults/reset, order/size/stat round trips, freshness/data preservation, and
compatibility with existing manual and appearance saves. It also snapshots
telemetry, publication, and existing extension credentials around layout writes.
Never run fixture SQL in a hosted project.

Verify `/u/<username>` and its Customize profile flow on desktop and mobile:

1. An existing profile with no saved layout has the expected default sections.
2. Reorder, hide/restore, resize, and choose/reorder stats using only the keyboard.
3. Preview changes before saving; cancel without changing the public profile.
4. Save, reload, and open a signed-out window to confirm persistence and controls.
5. Check manual, published synced, and unpublished/fallback profiles; also check
   published synced stats with languages unpublished and profiles with no links.
6. Confirm changing layout does not publish languages or change saved manual
   totals, appearance, sync settings, linked accounts, or the stats timestamp.
7. Confirm profile-details and appearance forms still save without resetting the
   layout. Check `/example` and the homepage preview for regressions.

## Migration and rollout — operator actions only

This implementation does not apply migrations, push commits, or deploy. Apply the
database migration before pushing the web release to the Vercel deployment branch.
The previous web release remains compatible with the added column and functions.
Rollback of the web release can leave this additive migration installed.

First test on a separate staging Supabase project with its actual existing
migration history. The production project reference documented in
`docs/PRODUCTION_AUTH_SYNC.md` is `pmzrqkmhdbshuoknyosi`; confirm that it is the
intended target. No production state was inspected or changed for this task.
There are now five migration versions in this checkout:

```text
20260827000000
20260827000100
20260909000000
20260910000000
20260924000000
```

This checkout currently has no `supabase/config.toml`. If it is still absent when
you perform the rollout, initialize the CLI configuration once:

```bash
supabase init
```

After review, run from `/Users/fstopyra/Desktop/stack-stats/stack-stats-web`:

```bash
supabase login
supabase link --project-ref pmzrqkmhdbshuoknyosi
supabase migration list
supabase db push --dry-run
```

For the already-working production sync deployment, the first four versions
should be recorded as applied and the dry run should propose **only**
`20260924000000_profile_layout.sql`. If history differs, reconcile it against the
actual installed schema before continuing; do not blindly repair history or rerun
old migrations. The earlier production runbook describes historical manual
migration cases. The layout rollout requires no auth, Vercel, publication, or
environment-variable changes.

When the pending migration list is correct, the operator applies it:

```bash
supabase db push
supabase migration list
```

Run `supabase/verify-production.sql` in the hosted SQL Editor. It is read-only and
asserts auth/sync/layout schema, profile RLS, function grants, layout validation,
and the timestamp trigger. If PostgREST has a stale schema cache after a successful
migration, run `NOTIFY pgrst, 'reload schema';` in SQL Editor and retry the save.
The CLI workflow and migration-history behavior are documented in the
[Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push)
and [migration guide](https://supabase.com/docs/guides/deployment/database-migrations).

Finally push the reviewed commit through the existing deployment workflow. The
checked-out branch for this task is `main` and its remote is `origin`:

```bash
git push origin main
```

Confirm the existing Vercel project still deploys this branch, then run the manual
checks above against the deployed profile. No extension release is needed.
