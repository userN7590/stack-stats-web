# Phase 9C — data-first profiles

## Audit before implementation

The starting tree was clean. Phase 9B, the Phase 9C brief and
`STACK-STATS-WEBSITE-VISUAL-DIRECTION.md` are the baseline. The user added the
visual handoff during the audit; implementation paused while all three documents
were read together. Content and typography lead, data is the decoration, and
structural rules remain quiet. No annotation or motion system is introduced.

- `profile-layout.ts` requires four singleton core sections in v1/v2. V2 adds
  up to six repeatable visualization sections. Stats are six legacy field IDs;
  only charts have independent identities. Core removal means hide/restore.
- `profile-modules.tsx` hard-codes “Development totals” and “Language activity”.
  Legacy chart data comes from profile totals/percentages, not the new registry.
  Its two-column grid supports full/half, and totals are always full width.
- The picker restores core sections or adds a separate “Visualization”. The
  chart editor selects one of two legacy datasets, then shape-compatible styles.
  Language share styles and palette/custom-color work are reusable. The existing
  line-change waterfall is a signed total comparison, not a day/hour ridgeline.
- dnd-kit already supports pointer/touch handles, keyboard sorting, arrow-button
  fallbacks, drag cancellation and live announcements. Save uses the owner RLS
  RPC; reset changes only the draft. Preview uses the public module renderer.
- Phase 9B defines 23 metrics (19 publishable) and five private datasets.
  Publication and data availability are independent of layout. The public route
  supplies only approved projection data, including for the owner. Its v2
  selection prevents manual fallback into unselected slots. Private project
  identities and coverage dates never belong in public layout/preview props.
- The privacy screen can preserve existing v2 selections but cannot choose them.
  It needs an explicit selection editor, separate from layout saves.
- Public hourly publication is 24 summed UTC bins. The private `hourlyUtc`
  dataset retains date × hour rows. A future public ridgeline needs an explicit
  publication contract as well as a renderer; this phase must not expose private
  rows to make that future chart possible.
- Existing tests cover strict v1/v2 schema, normalization, reorder/hide/restore,
  chart geometry/compatibility, public projection and SQL RLS/RPC behavior.

## Implementation decisions

Additive layout v3 keeps existing sections byte-for-byte when adding new content.
It permits repeatable single stats, configurable stat grids, dataset sections,
links and external documents. Existing modules retain their original meaning and
controls; owners may replace them explicitly. No automatic conversion of manual
values or aggregate percentages into telemetry is safe.

New data choices come exclusively from published Phase 9B metrics. Missing,
unpublished and observed zero are distinct. A blank stat/grid/dataset can be saved
and configured after publication. Publication controls live in Sync settings.

Use a shared six-column profile grid (full, two-thirds, half, third) with mobile
stacking, subtle rails and shared section/cell rules. Keep existing palette options.
No homepage, hero, annotations, motion system or ridgeline implementation.

Images are scaffolded until trusted upload storage, byte/dimension limits and
policies exist. External PDF links need no new storage or server fetches. The
editor must describe these as links, not uploads or verified document types.

## New content and schema

Layout **v3** is `{version:3, modules:[...]}` with 1–20 sections and at least one
visible section. Every new section has `type`, `id` (`sec_` plus a bounded stable
identifier), `visible`, and `size`: `full`, `two_thirds`, `half`, or `third`.
Legacy singleton keys and `viz_` identities remain valid in a v3 envelope. The
six-legacy-visualization limit remains; duplicates of singleton types/IDs fail.

| New type | Configuration and behavior |
| --- | --- |
| `single_stat` | A nullable public scalar metric ID and `style: number / label / context`. Number-only retains an accessible label. No synthetic sparkline. |
| `stat_grid` | `columns` and `rows`, each 2 or 3; `cells` contains exactly their product of nullable public scalar metric IDs. Repeated metrics are allowed. Resizing preserves the first cells; the editor explains that removed trailing cells leave the draft. |
| `dataset` | Nullable `config` containing dataset ID, published metric ID, renderer, explicit measure and existing palette/custom-color configuration. The dataset is chosen before compatible presentations. |
| `link_collection` | Up to eight labeled HTTPS links, with 80-character labels and 2,048-character URLs. Independent of saved profile GitHub/website fields. |
| `document` | Title (100 characters), optional HTTPS external URL. A labeled external link opens in a new tab; no iframe, server fetch, upload or HTML embedding. “Document / PDF” describes the link's intended use; the app does not inspect or certify its file type. |

Blank content can be saved deliberately. Public output shows “No stat selected”,
“No dataset selected” or the equivalent, and never invents data. Known sections
with missing publication remain present with “Not published”; published-but-null
or unavailable results show “Unavailable”. Observed zero stays zero.

The picker groups **Data / Media / Other**, followed by hidden-section restoration.
New sections open their contextual editor. Existing sections expose editing through
section options. Grips, pointer/touch dragging, keyboard sorting, arrow fallbacks,
Escape, focus return and announcements remain. Width/hide/remove live in options.
The last visible section cannot be hidden or removed. Removal has one-level undo
until save/reset; hiding preserves all choices for later restoration. Reset changes
the draft, not stored data. Save failure retains the draft. Cancel/navigation warn
about unsaved layout changes. External-link fields have an explicit Apply/Add step.

Fresh profiles using selected publication receive a registry-driven stat grid
containing up to six currently available approved scalars, plus published language
activity and existing profile links when available. Saved v1/v2 layouts are never
automatically converted. Manual and legacy-publication defaults remain unchanged.
Reset uses this same source-aware default selection.

## Data and presentation contract

| Dataset identity | Approved public metric/projection | Implemented presentations |
| --- | --- | --- |
| `languagesByDay` | `languages.activity`: aggregate counters by language, not public per-day language rows | Quantitative list, bars, dots, donut, orbital rings, bloom |
| `daily` | `schedule.daily`: approved recorded-local daily counters | Line, bars |
| `sessionStartCohorts` | `sessions.histogram`: nine completed-session active-duration bins | Histogram |
| `hourlyUtc` | `schedule.hourly_utc`: 24 aggregate UTC hour-of-day bins | Heatmap |

Metric labels, descriptions, units, supported presentations, privacy categories
and caveats come from the Phase 9B registry. The registry now also recognizes the
implemented language dots/bloom and daily line presentations. The content adapter
explicitly maps each public projection to its actual shape. A compatible style
must match both that shape and the metric's presentation capabilities. Private
project metrics/datasets cannot be saved as public content.

Language measure is explicit (time, content changes, additions or removals), with
shares recomputed from the summed counters. No silent switch from zero time to
edits. Language names and one-decimal percentages are display-only. Geometric
share charts bound their geometry to eight categories and combine the remainder
as “Other shares”; the quantitative list can show all rows. Existing palette IDs,
custom colors, contrast safeguards, and legacy charts remain available.

Daily charts use actual dates on the x axis; missing dates are neither zero-filled
nor joined by lines. A single observation remains a point. Histogram height shows
sample count, not density: unequal bucket ranges are explained and available in
the values table. Zero samples do not imply a median or duration. UTC heatmap
explicitly describes its aggregate population and separates null history from 24
observed zero bins. Charts are static SVG/CSS with accessible exact-value tables;
no GPU loop or new animation dependency was added. Duration formatting rounds only
display precision; no telemetry or publication payload is modified.

### Future hourly renderer boundary

Dataset references and renderer IDs are separate from module identity/layout.
`DataShape` includes `utc-day-hours` as a future shape, but no implemented renderer
claims compatibility with that private matrix. The existing owner-only `hourlyUtc`
dataset and per-date null/coverage semantics remain intact. A future renderer can
retain the v3 module/config shape and dataset identity; it requires registration,
a real adapter and corresponding strict SQL allowlist updates, not another layout
version. Publishing day × hour rows additionally requires an explicit approved
public projection and schedule consent. Phase 9C never fetches private hourly rows
inside public profiles or owner previews.

## Publication and compatibility

The owner customizer and visitor renderer receive the same approved public
projection. New metric choices are disabled unless the metric is present and
available there. Their labels explain unavailable/unpublished status and link to
`/settings/sync#publication`. Layout save invokes only `update_profile_layout`.
It cannot grant uploads, publish metrics, enable schedule permission, or reveal
private coverage/project identities. No sync protocol, auth or linking APIs change.

Sync settings now lets owners explicitly select the 19 public Phase 9B metric IDs.
It receives only availability IDs from the server's private summary, not an extra
private summary in public profile props. `schedule.daily` availability follows
observed daily records; richer metrics require their actual v2 observations.
Unavailable existing selections can be removed or retained, but cannot be newly
selected. Schedule IDs require a separate unchecked consent switch. Turning that
switch off removes schedule selections in the draft. Saving uses the existing
v2 privacy API; no backend publication rule is relaxed.

Legacy accounts retain their existing controls until “Choose individual metrics”.
The explicit transition starts with no selected metrics and no schedule consent,
explains the change from broad legacy publication, and permits cancellation before
saving. After a successful transition the UI does not offer a legacy downgrade.
Turning overall publication off retains selections and restores the existing
manual-profile fallback. It does not delete data or revoke editor authorization.

Saved legacy totals, languages and charts continue to render with their original
meaning and colors. There is no automatic conversion of manual totals, file counts,
project counts, aggregate language percentages, or legacy lifetime windows into
30-day telemetry definitions. Owners replace sections explicitly by adding the
new stat/grid/dataset section, configuring its approved data, then hiding/removing
the old section. Saved manual values and appearance are untouched. Hidden layout
configuration and external links remain part of the publicly readable profile row;
hiding is presentation, not a privacy mechanism.

Unknown/damaged v3 sections are omitted defensively from display and editing is
locked to prevent destructive rewrites. Known hidden sections are not made visible
as fallback. Unknown future envelope versions retain the existing default display
and read-only editor behavior. Strict client and SQL validation reject unknown
save semantics.

## Visual handoff implementation

Profile pages now share a six-column coordinate system within a 1,080px maximum
content width. Quiet outer vertical rails run through header, sections, whitespace
and footer; adjacent sections share horizontal boundaries. New spans occupy six,
four, three or two columns. Existing full/half sections occupy six/three. Below
768px every section stacks. Stat cells respond to their own available width, using
one/two columns in narrow modules and up to three in wide modules. Rules remain
subordinate to typography and data. The editor uses the same geometry and removes
floating-card gaps, rounded section frames and blurred toolbar treatment.

Retained: near-black/warm off-white palette, existing serif headings, mono metrics
and supporting UI, blue controls, restrained secondary data colors and breathing
room around headings. No new decorative graphics are invented. “Data is the
decoration” is expressed by real, approved activity charts in the shared structure.
Controls do not depend on hover; touch targets and focus rings remain. New charts
are stationary, with reduced-motion handling also disabling profile transitions.

**Phase 9D remains deferred:** homepage/hero redesign, hand-drawn annotations,
interactive waterfall/ridgeline, pointer physics, scroll choreography, broad motion,
share-card identity, annual recaps and developer-fingerprint branding.

## Image/upload scaffold and launch boundary

The Media picker exposes an explicitly unavailable Image entry and a useful link
alternative. It does not pretend that an image upload exists. A safe upload module
needs storage/policy work outside this phase. Proposed follow-up contract:

- Authenticated owner upload into an owner-scoped staging path, server-enforced
  5 MiB input cap, maximum 8,192px dimension and decoded-pixel budget.
- Accept raster JPEG/PNG/WebP, inspect bytes and re-encode/strip metadata. Reject
  SVG/HTML and arbitrary embeds. No server fetch of arbitrary image URLs.
- Store asset identity/validated dimensions; require descriptive alt text (up to
  500 characters), responsive `sizes`, lazy loading, bounded aspect ratio, and
  the same four layout spans. Asset publication must be explicit; hiding alone
  must not promise to revoke an already-public asset.
- Define owner deletion, orphan cleanup, storage quotas and public read policies
  before enabling the picker. Add image safety, ownership, mobile and missing-asset
  regressions then. No upload bucket or policy is created by Phase 9C.

Document uploads/thumbnails share this future infrastructure. Current document
links need no storage policy and perform no automatic external request.

## Database and production rollout

New migration: `supabase/migrations/20260928000000_profile_content.sql`.
It runs in one transaction, copies the original v1/v2 dispatcher body verbatim into
`profile_layout_v2_is_valid(jsonb)`, adds a bounded HTTPS-link validator, then
replaces the generic dispatcher **in place**. The existing CHECK remains bound to
the same function OID. The update RPC, table grants, RLS policies, timestamps,
profile rows, sync rows and publication choices are unchanged. Validators remain
immutable invokers with empty search paths, callable by authenticated only.
Original applied migrations are not edited or replayed.

Run these **entire files**, with no selected fragments, in Supabase SQL Editor:

1. `supabase/verify-profile-content-preflight.sql` — read-only, requires complete
   Phase 9B plus working v1/v2 layout validation and rejects existing/partial 9C.
2. `supabase/migrations/20260928000000_profile_content.sql` — additive transaction.
3. `supabase/verify-production.sql` — read-only; checks dependency chain, role
   access, invoker/search-path/immutability, active CHECK binding, valid v1/v2/v3
   and invalid/private/unsafe configurations, plus all existing sync/RLS checks.
4. After those pass, review/commit/push is safe for this change. A web release is a
   separate action; this session performs no push, deployment or production SQL.
   Install the database migration before serving web code that can save v3.

Stop on a failed preflight/verifier and inspect actual function definitions. A
failed complete migration rolls back every statement. An already-installed
migration must not be blindly replayed. A web rollback keeps the additive database
schema; do not restore the old generic validator after v3 layouts have been saved.

## Validation results and remaining checks

| Check | Result |
| --- | --- |
| `npm test` | 16 test files, 645 tests passed |
| `npm run lint` | Passed |
| `npx --no-install tsc --noEmit` | Passed |
| `npm run build` | Passed; production route manifest excludes the temporary browser fixture |
| Isolated SQL | Complete migration chain and all six SQL test files passed on PostgreSQL 18.3 / PGlite 0.5.8 |
| Shared contracts | 93 new profile-layout fixtures accepted/rejected identically by TypeScript and PostgreSQL; 93 existing sync-v2 fixtures also passed |
| Upgrade tests | Failed-transaction rollback and successful v1/v2-to-v3 upgrade preserve saved rows, publication, CHECK OID, RPC, grants and RLS |
| Production verifier | Full read-only verifier and 45 security/schema-drift scenarios passed |
| `npm run test:db` | Could not start: Docker daemon unavailable at the Colima socket. Equivalent SQL/harness checks above ran in the isolated engine. PostgreSQL 16/Docker remains a follow-up. |
| Browser | Chrome desktop (1360px), mobile (390px), narrow mobile (320px), touch emulation and reduced motion passed on synthetic data with mocked RPCs |
| `git diff --check` | Passed |

Browser coverage includes stat selection/style, stat-grid geometry and independent
cell edits, dataset measure/presentation/palette changes, width, pointer/keyboard
and touch drops, drag cancellation, focus return/Escape, hide/restore, remove/undo,
preview parity, failed save and successful retry, reset, schedule consent and its
withdrawal, legacy rendering, low data, unavailable/null, unpublished, observed
zero, single-date history, mobile stacking/overflow and chart-label bounds.
The browser runs caught and fixed SVG-title hydration and form-label association
issues, plus clipped numeric axes. There are no new runtime/hydration errors.

New/updated test files:

- `tests/profile-content.test.tsx`: strict v3, defaults/promotion, independent
  content, compatibility, publication and low-data presentation, media safety.
- `tests/fixtures/profile-content.json`: 93 shared valid/invalid SQL/client cases.
- `tests/fixtures/profile-content-preview.tsx`: synthetic interactive profile and
  privacy fixtures; never imported by product routes.
- `scripts/test-profile-content-browser.mjs`: Chrome interaction/mobile regression
  runner. Creates/removes a temporary route and generated type-cache references.
- `scripts/test-profile-content-contract.mjs`: runs shared fixtures against SQL.
- `scripts/test-profile-content-upgrade.mjs`: upgrade/rollback and replay refusal.
- `supabase/tests/profile_content.sql`: owner/other-owner/anon behavior, strict CHECK
  and RPC rejection, preservation of manual fields/timestamps and no publication.
- `scripts/test-database.mjs`: adds the new contract and upgrade tests to the
  existing disposable-database runner.
- `scripts/test-production-verifier.mjs`: six additional cases for v3 helper/URL
  grants, execution context, unsafe link validation and CHECK bypass (39 → 45).
- `tests/profile-layout.test.ts`, `tests/profile-presentation.test.tsx`,
  `supabase/tests/profile_layout.sql`, `supabase/tests/profile_visualizations.sql`:
  move future-version fixtures to v4 and assert the new structural span classes.
  Existing v1/v2 behavior tests remain intact.

No hosted-auth E2E or real production writes were performed. Browser RPCs are
mocked; isolated SQL tests exercise the actual RPC and security behavior. Safari,
Firefox, physical touch devices and screen-reader user testing remain manual
follow-up. The browser harness needs installed Chrome plus Playwright; it adds no
project dependency. For this workspace it ran with:

```sh
STACK_STATS_PLAYWRIGHT_PATH=/private/tmp/stack-stats-ui-check/node_modules/playwright/index.mjs \
  node scripts/test-profile-content-browser.mjs
```

For a fresh temporary Playwright installation, run
`npm install --prefix /private/tmp/stack-stats-ui-check --no-save --ignore-scripts playwright`
first. Run the browser harness before the production build; it uses the local dev
server and cleans up its ephemeral route. The Docker-free SQL run in this workspace
is `node /private/tmp/stack-stats-sql-check/run.mjs`; its temporary PGlite dependency
is outside the repo. The committed Docker runner is the durable CI entry point.

Screenshots use synthetic data, not production account data:

- `/private/tmp/stack-stats-phase9c/profile-desktop.png`
- `/private/tmp/stack-stats-phase9c/profile-mobile.png`
- `/private/tmp/stack-stats-phase9c/profile-editor.png`
- `/private/tmp/stack-stats-phase9c/profile-low-data-mobile.png`

Manual staging routes: `/u/<username>`, `/u/<username>?customize=1`,
`/settings/sync#publication`, and `/example`. Verify a saved v1 layout, saved v2
visualizations, limited selected publication, manual fallback with publication off,
owner versus visitor controls, and existing appearance settings. Image uploading
is intentionally scaffolded. Public dataset windows remain the current 30 days;
there is no date-range editor, scalar sparkline, public day×hour matrix, embedded
PDF viewer, new storage infrastructure or automatic legacy conversion.

## Exact file manifest

The following is the complete working-tree manifest. The visual-direction document
was supplied by the user during this task; its contents are preserved. No protocol
file, applied migration, auth/linking implementation or homepage source changed.

- `docs/PHASE-9C-PROFILES.md`
- `docs/STACK-STATS-WEBSITE-VISUAL-DIRECTION.md`
- `scripts/test-database.mjs`
- `scripts/test-production-verifier.mjs`
- `scripts/test-profile-content-browser.mjs`
- `scripts/test-profile-content-contract.mjs`
- `scripts/test-profile-content-upgrade.mjs`
- `src/app/globals.css`
- `src/app/settings/sync/page.tsx`
- `src/components/dashboard/sync-privacy.tsx`
- `src/components/profile/profile-content-editor.tsx`
- `src/components/profile/profile-content.tsx`
- `src/components/profile/profile-layout-editor.tsx`
- `src/components/profile/profile-modules.tsx`
- `src/components/profile/profile-section-picker.tsx`
- `src/components/profile/profile-view.tsx`
- `src/components/profile/sortable-profile-section.tsx`
- `src/lib/metric-registry.ts`
- `src/lib/profile-content.ts`
- `src/lib/profile-layout.ts`
- `supabase/migrations/20260928000000_profile_content.sql`
- `supabase/tests/profile_content.sql`
- `supabase/tests/profile_layout.sql`
- `supabase/tests/profile_visualizations.sql`
- `supabase/verify-production.sql`
- `supabase/verify-profile-content-preflight.sql`
- `tests/fixtures/profile-content-preview.tsx`
- `tests/fixtures/profile-content.json`
- `tests/profile-content.test.tsx`
- `tests/profile-layout.test.ts`
- `tests/profile-presentation.test.tsx`

## Exact staging and commit commands

Provided for review; not executed. No push or deploy command is included.

```sh
cd /Users/fstopyra/Desktop/stack-stats/stack-stats-web
git diff --check
git add -- \
  docs/PHASE-9C-PROFILES.md \
  docs/STACK-STATS-WEBSITE-VISUAL-DIRECTION.md \
  scripts/test-database.mjs \
  scripts/test-production-verifier.mjs \
  scripts/test-profile-content-browser.mjs \
  scripts/test-profile-content-contract.mjs \
  scripts/test-profile-content-upgrade.mjs \
  src/app/globals.css \
  src/app/settings/sync/page.tsx \
  src/components/dashboard/sync-privacy.tsx \
  src/components/profile/profile-content-editor.tsx \
  src/components/profile/profile-content.tsx \
  src/components/profile/profile-layout-editor.tsx \
  src/components/profile/profile-modules.tsx \
  src/components/profile/profile-section-picker.tsx \
  src/components/profile/profile-view.tsx \
  src/components/profile/sortable-profile-section.tsx \
  src/lib/metric-registry.ts \
  src/lib/profile-content.ts \
  src/lib/profile-layout.ts \
  supabase/migrations/20260928000000_profile_content.sql \
  supabase/tests/profile_content.sql \
  supabase/tests/profile_layout.sql \
  supabase/tests/profile_visualizations.sql \
  supabase/verify-production.sql \
  supabase/verify-profile-content-preflight.sql \
  tests/fixtures/profile-content-preview.tsx \
  tests/fixtures/profile-content.json \
  tests/profile-content.test.tsx \
  tests/profile-layout.test.ts \
  tests/profile-presentation.test.tsx
git diff --cached --stat
git diff --cached
git commit -m "Add data-first profile customization and structural layout v3"
```
