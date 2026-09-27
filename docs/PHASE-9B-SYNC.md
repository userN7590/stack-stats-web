# Phase 9B — versioned web/server aggregate foundation

Implemented locally against the complete `PHASE-9A-SYNC.md` handoff and the current
extension protocol, reducer, capability negotiation, and retry implementation in
`/Users/fstopyra/Desktop/projects/stack-stats`. The starting web working tree was
clean. No extension files, production records, deployed schema, or remote branches
were changed. No push/deployment was performed.

## 1. Verified source contract

The two files under `src/lib/stack-stats-protocol/` are byte-for-byte copies of
`packages/protocol/src/sync.ts` and `sync-v2.ts`. The old `src/lib/sync-contract.ts`
is unchanged. The extension's `check-sync-contract.mts --require-v2` passes.
Both versions use string wire discriminators and numeric aggregation version 1.

V2 has exactly 20 required keys: schema/aggregation version, date, revision, four
counters, session-days, session starts, incomplete starts, file/language/project
counts, languages, projects, project overflow, completed-session durations,
nullable hourly UTC, and coverage. No optional extra keys are accepted. Nullable
hourly data and nullable observation dates are explicit fields, not omitted keys.

Bounds match Phase 9A: 65,536 UTF-8 bytes, 128 language/project rows, daily/hourly
active time 604,800,000 ms, other counters 1,000,000,000, revision and completed
cohort active time 1,000,000,000,000. Dates are valid 2000–2099 calendar dates.
SQL independently checks types, exact keys, sorted unique allowlisted identities,
array lengths, counter totals, overflow, cohort equations, histogram feasibility,
and coverage. It does not normalize contradictory input into an accepted payload.

## 2. Original v1 path and v2-aware boundaries

```text
extension session snapshots / v1 curator
  -> PUT /api/v1/sync/installations/{uuid}/days/{date}
  -> putSyncDay / parseSyncDay
  -> bearer-checked sync_put_day + stats:write scope
  -> sync_installations + one sync_days row per owner/installation/date
  -> private sync_aggregate / sync_private_summary
  -> /settings/sync and /api/v1/sync/summary
  -> publish_profile / publish_languages
  -> sync_public_profile fixed allowlist
  -> withSyncedProfile -> profile metrics and existing visualization datasets
```

Every boundary that changes for v2 is implemented: separate HTTP parser/route,
shared version-aware SQL writer, explicit richer grant metadata and exchange
propagation, grant-scoped capability GET, independent SQL validation, mixed-version
legacy reducer, v2 summary/dataset reducers, private adapters, selected publication
RPCs, legacy publication gate, profile adapter guards, verifier, migration preflight,
and regression tests. RLS, profile ownership, manual editing, appearance/layout,
account identity linking, and v1 protocol parsing remain in place.

## 3. HTTP/API support

All new responses use `Cache-Control: no-store`; errors omit payloads and database
details. There is no service-role client or caller-supplied owner parameter.

| Route | Authentication / behavior |
| --- | --- |
| `GET /api/v1/sync/capabilities` | Existing bearer token; calls `sync_capabilities`. Exact `{schemaVersion:"1",dailyVersions:["1"]}` or `["1","2"]` response, depending on this connection's consent. |
| `PUT /api/v1/sync/installations/{uuid}/days/{date}` | Original strict v1 parser and acknowledgement; shared writer rejects downgrade of an existing v2 row. |
| `PUT /api/v2/sync/installations/{uuid}/days/{date}` | Exact vendored v2 parser, URL/body date match, same owner/installation/day namespace and writer. |
| `GET /api/v2/sync/summary?period=30&to=YYYY-MM-DD` | Fresh authenticated browser session. Periods 7, 30, 90, lifetime. Versioned summary DTO. |
| `GET /api/v2/sync/datasets?dataset=hourlyUtc&period=7&to=YYYY-MM-DD` | Browser session. Five enumerated datasets; 7/30/90 dates. |
| `GET /api/v2/sync/privacy` | Owner's publication version, selections, schedule flag and legacy booleans. |
| `PUT /api/v2/sync/privacy` | Same-origin browser session; strict `{schemaVersion:"2",publishProfile,metricIds,publishSchedule}`. |
| `GET /api/v2/sync/export` | Owner-only canonical payload export, 50 records per page. Follow `next` with `afterDate` and `afterInstallation` until null. |
| `DELETE /api/v2/sync/data` | Same-origin browser session and exact `{confirmation:"delete-cloud-sync-data"}` body. Deletes live cloud sync data and revokes upload grants. |

V2 acknowledgement is exactly `{schemaVersion:"2",installationId,date,revision,
unchanged}`. Equal-body retries return the same revision with `unchanged:true`.
Invalid/malformed/future versions are 400; invalid/expired bearer 401; inadequate
consent/scope 403; stale/conflicting/downgrade writes 409; installation limit 422;
write quota 429; unavailable service 503. Dataset/aggregate result limits are 413.
HTTP upload byte overflow retains the existing 400 invalid-request convention.
No successful failure response is silently converted to v1.

## 4. Supabase changes and consent

One new transactional migration:
`supabase/migrations/20260927000000_sync_daily_v2.sql`.

- Adds `stats_schema_version` (default 1) and `stats_consent_at` to auth codes and
  connections. Version 2 requires `stats:write` and a consent timestamp.
- Adds `publication_version` (default 1), `published_metrics` (default empty), and
  `publish_schedule` (default false), with a validated selection allowlist.
- Leaves the `sync_days` schema, canonical primary key, saved revisions/payloads,
  profile rows, table grants, and RLS policies unchanged. No telemetry backfill.
- Replaces `extension_exchange` to copy consent metadata into the new connection.
  Refresh retains that connection/version; a request body never upgrades a grant.
- Adds `extension_authorize_stats_v2`, `sync_capabilities`, independent v2 validator
  and private validation helpers; replaces the existing writer with a dispatcher.
- Adds `sync_aggregate_v2`, `sync_private_summary_v2`, `sync_datasets_v2`,
  `sync_private_datasets_v2`, publication getter/setter/allowlist helpers,
  `sync_public_profile_v2`, `sync_export_v2`, and `sync_erase_cloud_data`.
- Replaces legacy aggregation to understand mixed daily versions and legacy
  publication to gate on publication version 1. Legacy setter cannot restore broad
  publication after an account selects version 2.

All private tables remain inaccessible directly to anon/authenticated. Aggregate,
validation, numeric-bound, period, and publication helpers are not client-callable.
Security-definer functions use an empty search path and qualified private objects.
Only bearer-checked entry points and explicit public projections permit anon calls.
Browser consent/private/privacy/export/erasure wrappers permit authenticated only.

The existing stats consent screen now offers an **unchecked** richer-aggregate
choice. It names starts, completed active durations/histograms, observed coverage,
project activity, and optional work-pattern-revealing UTC hours. Hourly upload
still requires the separate default-off extension option. Existing grants receive
only `["1"]`; accepting this disclosure creates a new v2-consented grant. Identity
linking alone grants neither v1 nor v2 uploads. All decisions remain server-enforced.

## 5. Canonical replacement and aggregation laws

The writer preserves the owner advisory lock, 60/minute write accounting and
32-installation cap. All versions share one owner/installation/date record.
Promotion requires a higher revision. A lower revision is stale; equal revision
with equal JSONB content is an idempotent retry, and with different content is a
conflict. Any valid v1 replacement of v2 is rejected before revision comparison,
even with a larger revision. Full replacements include `hourlyUtc:null`.

| Population | Merge / meaning |
| --- | --- |
| Four daily counters | Sum canonical rows. Active time is evidence-backed inter-edit time; content changes are not callbacks, batches or keystrokes. |
| Session-days | v1 `sessionCount` or v2 `sessionDays`, summed as participation only. |
| Session starts / incomplete starts | Sum v2 start cohorts only. V1 precision remains unavailable; incomplete does not mean currently online. |
| Completed cohort | Sum count, active milliseconds, edits and line counters; element-wise sum nine histogram bins. Min/max only over nonempty cohorts. Mean = total completed active ms / total completed count; null for zero samples. |
| Cohort ownership | Original recorded-local session start date, including whole-session activity across midnight. Never substitute the day's activity numerator. |
| Histogram | Exclusive upper bounds `[1,60000,300000,900000,1800000,3600000,7200000,14400000]` ms, then >=4h. Bucket 0 is exactly zero active ms. No exact median. |
| Active dates | Union recorded-local dates with positive edits or active time, then count. |
| Files | Sum file-days. No lifetime/cross-device unique-file inference. |
| Languages | Sum counters by normalized ID; count unioned IDs. Shares use an explicitly selected summed measure. Lexical ID breaks equal-measure ties. |
| Projects | Group by installation plus HMAC alias. Source overflow count is project-day participation, not distinct lifetime projects. Known alias count is a lower bound when overflow exists. |
| Project selection | Summary returns top 128 known aliases, ordered by summed active time, edits, additions, removals, installation and alias. Omitted known counters/count are preserved separately from source overflow. Daily project datasets preserve source overflow rows. |
| UTC hours | Element-wise sum 24 bins over compatible UTC dates. Never add to collector-local totals, scale to match them, or relabel them as local time. |

Very large results that exceed JavaScript's exact numeric range fail explicitly
with an aggregate limit rather than rounding integer counters. Derived averages
may be fractional. V1-only responses retain existing behavior. When new v2 source
overflow prevents an exact legacy project count, it becomes null and the current
profile shows “Unavailable”; it does not display a fabricated exact count.

## 6. Private datasets and registry

`metric-registry.ts` defines 23 stable metric IDs with definition version, label,
description, unit, shape, source, required wire version, date basis, merge law,
privacy category/publication capability, supported periods, presentations, empty
state, and semantic caveats. `sync-datasets.ts` validates DTOs and exposes
`privateMetrics`, `privateDataset`, `publishedMetrics`, and `activityShares`.
Components consume these adapters rather than private database rows. Sync settings
now uses the private metric adapter; its existing basic view is retained.

Five bounded dataset IDs:

- `daily`: observed recorded-local dates, four counters, session-days, file-days,
  and source/version coverage.
- `languagesByDay`: date + normalized language ID + four counters.
- `projectsByDay`: date + installation/alias + four counters, with separate
  overflow rows/counts. This dataset is always private.
- `sessionStartCohorts`: date + starts/incomplete starts + completed count, active
  sum, edit/line sums, min/max/mean and nine histogram bins. V1-only dates have null
  richer fields, not fake zero cohorts.
- `hourlyUtc`: observed date + nullable UTC arrays + per-date coverage. This can
  drive a future day × hour heatmap, waterfall or ridgeline without new sync fields.

Dataset requests allow 7/30/90 dates. Expansion is bounded to 10,000 source rows
and 2 MiB of row JSON, with an explicit limit error instead of truncation. Summary
projects are capped separately with a counter-preserving remainder. Export offers
paged canonical rows when a large private dataset exceeds presentation limits.

## 7. Coverage and hourly semantics

Every result remains partial observation, never lifetime completeness or verified
human work. Summary coverage retains source/date basis, v1/v2/total record counts,
first/last uploaded dates, distinct uploaded dates, first/last observed source dates,
and earliest/latest persisted upload floors. A source date before the upload floor
does not imply its counters reached the server. Coverage floors from different
installations are not collapsed into a claim that all devices covered one range.

Hourly record/date counts, frozen-record counts and late-input-ignored counts are
separate. The hourly payload identifies `telemetry-v2` and `UTC`; general session
coverage remains labeled `sessions-v1` and `collector-local`. Per-date datasets
retain both populations' availability. Absence, a null optional hourly value, and
24 observed zero bins remain distinct. Missing dates are not zero-filled. Historical
hourly input is never reconstructed from daily totals.

The client can replace the canonical hourly field with null on a higher revision;
other installations' hours remain. This does not erase backups or locally retained
hourly history. Frozen/late-input flags describe the client replay boundary and may
reflect a retry offered after compaction. Batch timing is not keystroke precision.

## 8. Publication behavior and current profile compatibility

Legacy publication still exposes only `activeMs`, `editCount`, `linesAdded`,
`linesRemoved`, `fileDays`, `projectCount`, `recordCount`, `updatedAt`, and optionally
language counters. V2 upload alone adds **no** published category.

Version-2 publication has 19 individually selectable IDs: four daily counters,
net/churn, file-days, active-day count, session-days/starts/completed count/completed
active time/mean/maximum/histogram, language count/activity, daily schedule and UTC
hour patterns. Daily/hour pattern IDs additionally require schedule permission.
Project IDs/installation IDs and private coverage dates are excluded. Each selected
result has only its ID, definition version, unit, quality, date basis, and approved
value/dataset. Unselected IDs are omitted; private coverage does not hitchhike on
an unrelated public metric.

For a version-2 account the legacy public RPC returns null, and the legacy privacy
setter rejects broad reset. The public route first uses the selected projection,
then uses legacy publication only when there is no v2 projection. Limited/empty
v2 selections never fall back to manual telemetry values in those slots. Existing
stat boxes show “Not published” or “Unavailable”; line comparisons require both
selected values. Saved manual values and layout/appearance remain unchanged.
The old privacy screen can toggle the already-selected publication while preserving
its selections. A new selection editor remains Phase 9C work.

No profile/homepage redesign, new widget editor, chart system, or AI integration was
implemented. New backend publication candidates exist for later UI work; this task
does not start automatically displaying richer session/hourly charts.

## 9. Export, erasure and remaining correctness limits

Export and erasure are explicit authenticated APIs, separate from upload and public
visibility toggles. Erasure deletes live sync installations/days, privacy selections
and rate counters; it revokes stats-upload connections and pending stats grants.
It preserves identity-only connections, manual profile values, and local files.
Writer/erasure locks and a post-lock token recheck prevent a waiting old upload from
recreating erased data. Exchange locks before code consumption prevent a pending
pre-erasure code from resurrecting its grant. A later explicit new approval may
allow new uploads again.

The application keeps one canonical row, not an application-accessible revision
archive. PostgreSQL MVCC remnants, provider backups/PITR and downloaded exports are
not physically purged by this RPC. Provider backup retention must be handled by the
project operator; exported copies remain under the recipient's control. No claim
of immediate physical erasure of those copies is made. Export pagination is stable
by date/installation key, but is not a transaction-wide snapshot during concurrent
uploads. Stop uploads for an archival export that must represent one fixed moment.

Remaining boundaries:

- Independent devices/windows can double-count overlapping physical work.
- Recorded-local dates may originate in different time zones and cannot be rebinned.
- V1 history has no complete start/duration/hourly cohort; no missing precision is
  inferred. Client promotion/backfill depends on retained local data and consent.
- Frozen/pruned/uncollected hourly history cannot be rebuilt; null is unavailable.
- Project overflow prevents exact period-wide distinct identities/rankings; aliases
  are intentionally installation-scoped, not global repositories.
- Extreme/high-cardinality periods can exceed numeric/dataset limits. Choose a
  smaller window or export pages; results are not silently truncated.
- SQL regressions ran in isolated PostgreSQL 18.3/PGlite. Docker's PostgreSQL 16
  runner was unavailable because its daemon was stopped. No hosted Auth E2E or
  real concurrent PostgreSQL sessions were exercised in this environment.

Possible now without additional telemetry: coding-time numbers/series, daily/weekday
activity, active dates and bounded-window streak derivation, session start/completed
counts, mean/min/max active duration, duration distribution, cohort edit/line ratios,
measured language shares/rankings, private known-project activity, optional UTC hour
and day×hour visualizations. Phase 9C still needs presentation/selection UI.

Blocked by missing wire telemetry: exact session median, globally unique files or
repositories, cross-device deduplicated human time, reconstructed old hours, true
idle/productivity/skill, characters/undo/redo/saves/workflow/Git/diagnostics/switching,
and AI model/token/cost/provenance metrics. Local observations in those categories
are not a license to invent synced fields.

## 10. Production sequence and recovery

Review the diff and run the following **entire SQL files** in the intended Supabase
project, using no selected fragments:

1. `supabase/verify-sync-v2-preflight.sql` (read-only). It checks actual prerequisites,
   private table grants/RLS, absence of a prior/partial v2 schema, and canonical
   existing v1 payload/date/revision agreement. It also requires the prior profile
   visualization schema. Stop and inspect any failure; do not weaken validation.
2. `supabase/migrations/20260927000000_sync_daily_v2.sql`. One transaction; no data
   rewrite, speculative backfill, or automatic consent/publication promotion.
3. `supabase/verify-production.sql` (read-only). Requires old and new functions,
   exact role access, safe definer contexts, v1-default metadata, publication
   constraints, valid/invalid synthetic payloads and existing profile RLS checks.
4. Only after success is the web implementation ready for a separately authorized
   release. Renew stats consent with the unchecked richer option explicitly chosen
   to obtain a v2-capable connection. Existing grants remain v1. Hourly remains off
   until the separate editor setting is enabled.

The migration is not intended to be replayed after successful installation. If the
preflight finds v2 objects, run the full verifier and inspect definitions/state.
A failure inside the complete migration rolls back the transaction; upgrade tests
inject such a failure and prove rows, old grants and publication are preserved.
Do not “repair” a partial/manual execution by dropping existing data or replaying
arbitrary statements. Investigate actual definitions and make a targeted additive
repair if needed. Do not roll a promoted database back to a v1 writer; that would
remove downgrade protection. A web rollback must retain the v2-capable database.

Manual/staging verification: existing v1 editor upload; identity-only connection
denial; old stats grant advertises only v1; fresh richer consent advertises v2;
lost-response v2 retry; older-window downgrade conflict; private summary/datasets;
optional UTC upload/withdrawal; legacy public profile; empty/limited v2 publication;
owner Sync settings; manual/appearance/layout edits. Export/erasure tests belong on
a disposable staging account, not valuable production history.

## 11. Validation and exact implementation manifest

The source parity check passes for both protocol versions. Shared fixtures exercise
93 independent SQL and TypeScript cases; HTTP tests reject malformed fixtures before
RPC. SQL tests cover grant negotiation, preserved v1 behavior, promotion/retries,
downgrade, scope/refresh, independent installations/dates, sum/min/max/mean/histogram,
project overflow/caps, hourly sums/withdrawal, empty/missing data, private ownership,
public field exclusions, schedule consent, export, erasure and client-role denial.
Upgrade tests preserve legacy data/grants/publication and prove transaction rollback.
The production verifier has 39 passing isolated security/drift scenarios.

Build compatibility: the exact upstream bundle imports `./sync.js` from TypeScript.
The production Webpack resolver now falls back from a missing `.js` to `.ts` while
preferring existing JavaScript. `npm run dev` uses Webpack too, matching the existing
production build; Turbopack did not resolve this import. The vendored source remains
unchanged. See [Webpack extension alias documentation](https://webpack.js.org/configuration/resolve/#resolveextensionalias).
A localhost unauthenticated v2 request with Supabase disabled returned the expected
401 after successful compilation; no hosted credentials were used for this check.

Validation results and the exact staging/commit block follow below.

### Validation results

| Check | Result |
| --- | --- |
| `npm test` | 15 files, 529 tests passed |
| `npm run lint` | Passed |
| `npx --no-install tsc --noEmit` | Passed |
| `npm run build` | Passed; production route compilation verified |
| Isolated SQL | Full migration chain, all five SQL test files, 93 shared validator fixtures, upgrade/rollback tests, 39 verifier scenarios passed on PostgreSQL 18.3/PGlite |
| `npm run test:db` | Docker runner unavailable: stopped daemon; its SQL/harness tests were run in the isolated engine instead |
| Extension `--require-v2` parity | Passed, both protocol versions and existing SQL language parity |
| SQL DTO → TS adapters | Real SQL summary, five datasets and 19 public metrics passed runtime adapters |
| Local route smoke | Supabase disabled; unauthenticated v2 PUT compiled and returned 401 |
| `git diff --check` | Passed |

### Exact changed files

- `docs/PHASE-9B-SYNC.md`
- `next.config.ts`
- `package.json`
- `scripts/test-database.mjs`
- `scripts/test-production-verifier.mjs`
- `scripts/test-sync-v2-contract.mjs`
- `scripts/test-sync-v2-upgrade.mjs`
- `src/app/api/v1/sync/capabilities/route.ts`
- `src/app/api/v2/sync/data/route.ts`
- `src/app/api/v2/sync/datasets/route.ts`
- `src/app/api/v2/sync/export/route.ts`
- `src/app/api/v2/sync/installations/[installationId]/days/[date]/route.ts`
- `src/app/api/v2/sync/privacy/route.ts`
- `src/app/api/v2/sync/summary/route.ts`
- `src/app/settings/sync/page.tsx`
- `src/app/u/[username]/page.tsx`
- `src/components/auth/extension-consent.tsx`
- `src/components/dashboard/sync-privacy.tsx`
- `src/components/profile/profile-modules.tsx`
- `src/lib/extension-api.ts`
- `src/lib/extension-auth.ts`
- `src/lib/metric-registry.ts`
- `src/lib/profile-metrics.ts`
- `src/lib/stack-stats-protocol/sync-v2.ts`
- `src/lib/stack-stats-protocol/sync.ts`
- `src/lib/sync-api.ts`
- `src/lib/sync-datasets.ts`
- `src/lib/sync-v2-api.ts`
- `src/lib/synced-profile.ts`
- `src/lib/types.ts`
- `src/lib/visualization.ts`
- `supabase/migrations/20260927000000_sync_daily_v2.sql`
- `supabase/tests/sync_daily_v2.sql`
- `supabase/verify-production.sql`
- `supabase/verify-sync-v2-preflight.sql`
- `tests/fixtures/sync-v2-contract.json`
- `tests/profile-route.test.tsx`
- `tests/sync-datasets.test.ts`
- `tests/sync-v2.test.ts`

Added tests: `tests/sync-v2.test.ts`, `tests/sync-datasets.test.ts`, `tests/fixtures/sync-v2-contract.json`, `supabase/tests/sync_daily_v2.sql`, `scripts/test-sync-v2-contract.mjs`, and `scripts/test-sync-v2-upgrade.mjs`. Updated tests: `tests/profile-route.test.tsx`, `scripts/test-production-verifier.mjs`, and the `scripts/test-database.mjs` orchestration. Existing SQL tests and applied migrations were not rewritten.

### Exact review, staging and commit commands

These commands are provided for review; they were not executed. No push or deploy
command is included. Stage only the enumerated Phase 9B paths:

```sh
cd /Users/fstopyra/Desktop/stack-stats/stack-stats-web
git diff --check
git add -- \
  docs/PHASE-9B-SYNC.md \
  next.config.ts \
  package.json \
  scripts/test-database.mjs \
  scripts/test-production-verifier.mjs \
  scripts/test-sync-v2-contract.mjs \
  scripts/test-sync-v2-upgrade.mjs \
  src/app/api/v1/sync/capabilities/route.ts \
  src/app/api/v2/sync/data/route.ts \
  src/app/api/v2/sync/datasets/route.ts \
  src/app/api/v2/sync/export/route.ts \
  'src/app/api/v2/sync/installations/[installationId]/days/[date]/route.ts' \
  src/app/api/v2/sync/privacy/route.ts \
  src/app/api/v2/sync/summary/route.ts \
  src/app/settings/sync/page.tsx \
  'src/app/u/[username]/page.tsx' \
  src/components/auth/extension-consent.tsx \
  src/components/dashboard/sync-privacy.tsx \
  src/components/profile/profile-modules.tsx \
  src/lib/extension-api.ts \
  src/lib/extension-auth.ts \
  src/lib/metric-registry.ts \
  src/lib/profile-metrics.ts \
  src/lib/stack-stats-protocol/sync-v2.ts \
  src/lib/stack-stats-protocol/sync.ts \
  src/lib/sync-api.ts \
  src/lib/sync-datasets.ts \
  src/lib/sync-v2-api.ts \
  src/lib/synced-profile.ts \
  src/lib/types.ts \
  src/lib/visualization.ts \
  supabase/migrations/20260927000000_sync_daily_v2.sql \
  supabase/tests/sync_daily_v2.sql \
  supabase/verify-production.sql \
  supabase/verify-sync-v2-preflight.sql \
  tests/fixtures/sync-v2-contract.json \
  tests/profile-route.test.tsx \
  tests/sync-datasets.test.ts \
  tests/sync-v2.test.ts
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "Add consent-gated v2 sync aggregates and metric datasets"
```
