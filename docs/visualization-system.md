# Profile visualization system

Implemented 2026-09-25. This document describes the current code and operator rollout. The [research report](visualization-research.md) contains all 19 requested chart evaluations, the broader compatibility matrix, release roadmap, unusual-chart backlog, experimental lab, archetype research, and library comparison. The [data inventory](visualization-data-inventory.md) records exact public/private/local inputs and what future datasets would require.

## What ships

Owners can add up to six independent visualization sections, choose their public data, select a compatible chart from real-data previews, and change its colors. Each section participates in the existing drag/arrow ordering, hide/restore, full/half width, preview, Save, Cancel, and Reset flow.

| Data choice | Available chart choices | Meaning |
| --- | --- | --- |
| Language activity | Bars, Dots, Orbital rings, Language bloom, Donut | Published language activity percentages, or the existing manual profile percentages when that is the resolved source. |
| Code changes | Waterfall | Added lines minus removed lines, ending at a signed edit balance. This is not repository size, committed code, or productivity. |

The bloom uses equal-angle petals with colored area proportional to share, including the central hole. Orbital rings use a common percentage-to-angle mapping; ring radius is decorative. Bars/dots use a shared 0–100% scale. Waterfalls support positive, zero, and negative balances, including all-added or all-removed data. Labels, a data table, source wording, and a short explanation accompany the graphic.

This release adds no chart dependency, HTTP endpoint, sync payload field, collector signal, publication permission, or source-code upload. It does require one additive database migration to validate visualization configuration in the existing `profiles.profile_layout` JSONB column. The existing authenticated, RLS-scoped save RPC remains the save path.

## Architecture

```text
Existing profile route + existing publication/manual fallback
                         ↓
                  PublicProfile only
                         ↓
        getVisualizationDataset(profile, datasetId)
         language_share / share / percentage rows
         line_changes / change / signed line rows
                         ↓
         dataset kind ↔ renderer kind compatibility
                         ↓
     versioned configuration + declared appearance controls
                         ↓
          resolveAppearance → bounded React SVG
                         ↓
        source label + graphic + values table + note
                         ↓
       repeatable visualization profile layout module
```

The dataset adapter and registries are in [visualization.ts](../src/lib/visualization.ts). Renderers consume a normalized dataset with named rows, a unit, source wording, a note, and an empty-state message. They do not query Supabase, request private summaries, read local telemetry, infer dates, or reinterpret unrelated headline totals as a comparable vector.

`datasetDefinitions` identifies the two supported data choices. `rendererDefinitions` supplies labels, explanations, the compatible dataset kind, and its appearance capability (`categorical` or `signed`). `compatibleRenderers` drives the chart picker and the strict configuration validator. A language chart cannot be saved against code changes, and a waterfall cannot be saved against language percentages. These combinations are independently checked by the database.

[visualization-chart.tsx](../src/components/profile/visualizations/visualization-chart.tsx) contains the six deterministic SVG presentations. The same component renders the public graphic and the chart-choice previews, using the owner's actual resolved public values. Responsive `viewBox` geometry avoids a browser measurement dependency for initial output. SVG geometry is serialized to four decimal places so minor Node/browser trigonometry differences do not produce hydration mismatches. [visualization-section.tsx](../src/components/profile/visualizations/visualization-section.tsx) supplies the source label, title, values table, and explanatory note. Percentages are displayed to one decimal place; line counts remain numeric counts.

The implementation deliberately has two dataset kinds, not a general analytics query language. Adding a later chart requires a renderer definition, compatible data shape, geometry, meaningful appearance capabilities, and tests. Adding a new dataset first requires the publication/coverage decisions in the inventory. A registry entry never grants permission to expose new data.

## Data integrity and publication

All charts receive the same `PublicProfile` projection already used by the existing public profile and owner preview. Existing source selection remains authoritative:

- Published synced totals replace manual totals; the datasets never add both together.
- If synced data is unavailable or unpublished, the existing manual fallback remains available.
- If synced totals are public but synced language publication is disabled, charts do not substitute saved manual languages. They display “No language activity is published.”
- Automatically tracked data is described as such, without a verification badge, skill claim, or assertion of absolute truth.
- Raw VS Code language IDs and stored percentages remain unchanged. Display names are normalized at the presentation boundary.

Invalid or empty input produces an explanation, not invented data. Negative, nonfinite, or over-100 individual shares are rejected. Empty/zero-only language data does not become a fictional 100% category. Valid shares below 100% retain their values and gain an explicit **Unspecified** remainder; the note says this is not additional tracked activity.

The existing manual rounding tolerance is preserved: totals up to 100.01% are accepted, with excess adjusted for rendering and explained when beyond floating-point noise. Totals below 100% are not scaled upward; they receive the explicit remainder. Larger excess totals are rejected. Saved manual values are never changed by this presentation adapter.

Geometry and color controls are bounded to eight rows. More entries become the seven largest supplied shares plus **Other shares**, with the sum of remaining values and a grouping note. The Unspecified remainder can be part of that final group; its explanatory note is retained. This grouping limits label clutter without silently dropping measured share.

No time-range control is offered because these public inputs are aggregate totals/shares. Daily lines, sparklines, calendars, topography, session distributions, relationship maps, and archetype classification are not implemented. Existing private/local data does not make those datasets public by implication.

## Configuration and persistence

There are two independent versions:

| Version boundary | Current behavior |
| --- | --- |
| Profile layout v1 | Still the default: the original four singleton sections and their existing settings. Existing stored rows are not rewritten. |
| Profile layout v2 | Adds zero to six repeatable visualization rows alongside all four core sections. Creation of the first visualization upgrades the draft to v2. Removing charts does not silently downgrade it. |
| Visualization config v1 | Strict `version`, `dataset`, `renderer`, and `appearance` fields. Future config versions are not guessed. |

Each visualization gets a stable `viz_…` identity; order, size, visibility, and configuration are per instance. The maximum of six includes hidden visualizations. Identical chart types are allowed as separate modules; duplicate IDs are rejected. Core sections remain singleton sections. At least one module must remain visible, so the last visible visualization cannot be removed/hidden without first restoring or adding another section.

Example row inside a **v2** layout (the full layout must also contain all four core sections):

```json
{
  "type": "visualization",
  "id": "viz_example",
  "visible": true,
  "size": "half",
  "config": {
    "version": 1,
    "dataset": "language_share",
    "renderer": "polar_area",
    "appearance": { "palette": "neon" }
  }
}
```

Saving uses the existing `update_profile_layout(jsonb)` RPC after strict client validation. The migration preserves the original v1 validator as `profile_layout_v1_is_valid(jsonb)` and replaces `profile_layout_is_valid(jsonb)` **in place** with v1/v2 dispatch. This preserves the CHECK constraint's function identity. It does not rename the CHECK's function out from under it, rewrite profiles, alter RLS, change profile grants, or replace the save RPC. Layout-only saves retain the existing timestamp behavior.

Read normalization remains defensive. Invalid appearance can fall back to Stack Stats colors without changing chart semantics. Unknown renderer/dataset/config semantics are omitted publicly, and the owner editor disables saving to preserve the stored configuration. Unknown future layout versions retain the existing default-presentation/read-only-editor fallback. No normalization writes to the database by itself. An unavailable future chart never triggers a private-data fetch or a fabricated replacement chart.

## Color system and accessibility

The implemented presets are **Stack Stats**, **Neon**, **Ice**, **Sunset**, **Accessible contrast**, and **Monochrome**, plus **Custom colors**. Presets apply immediately. Custom category controls appear only for displayed language rows, up to eight; waterfall exposes two controls, **Added / positive** and **Removed / negative**. The balance uses the color for its sign. Reset colors restores the Stack Stats preset.

Color values are strict six-digit hexadecimal values. Missing custom channels use defaults. Essential colored marks use a minimum 3:1 contrast check against the fixed dark chart background; a too-dark custom choice triggers a warning and renders with a readable fallback. The color input retains the requested color so the owner can correct it and the warning stays visible. Labels, axes, and table values keep fixed readable colors. These safeguards do not claim that every pair of palette colors is distinguishable for every viewer; the visible values table and labels communicate the data independently of color.

Gradient stops, custom backgrounds, editable grids, per-renderer stroke/fill controls, and scientific surface color scales are future capability extensions, not controls implemented now. The current UI exposes only controls the current charts use.

Charts include an SVG image label and string-based titles, a caption, and a semantic values table with row/column headings. They require no animation, hover, tooltip, canvas, WebGL, or client chart library to convey their data. Choices use native buttons and color inputs, visible focus styles, and touch-sized targets; chart thumbnails are removed from the accessibility tree because their enclosing button names the choice. The existing editor supplies keyboard/touch arrow reordering, drag controls, focus restoration, and save/error announcements.

## Owner editing flow

1. Open `/u/<username>?customize=1` as the owner.
2. Choose **Add section → Visualization**. A new full-width section appears at the end and receives focus. If the public projection has language rows, its default is Language bloom; otherwise its default is the code-change waterfall, which can show an honest empty state.
3. The new section's **Chart style & colors** disclosure starts open. Choose **Show: Language activity / Code changes**, then a compatible style card. Each thumbnail and the section preview uses actual current profile data.
4. Select a preset or **Custom colors**. Changes appear immediately in the draft preview; changing the data resets the chart to a compatible default while retaining appearance choices.
5. **Done** closes the disclosure and returns focus to its summary. It does not save or publish changes. Existing sections can be edited by reopening the same disclosure.
6. Use the section grip/arrows and overflow controls for position, width, and hiding. **Add section** restores hidden instances with their saved settings. **Remove visualization** deletes that instance from the draft when another visible section remains.
7. **Preview** shows the public presentation. **Save layout** persists the draft; **Cancel** discards it. **Reset layout** restores the original default sections in the draft, removing visualization choices only if the owner subsequently saves.

Owner controls remain hidden from visitors, including visitors who append `?customize=1`. Profile details, appearance settings, and Sync settings remain separate existing destinations. Adding a chart never changes the profile's publication settings.

## Library decision and limits

No dependency or lockfile change is required. Small React SVG renderers give this bounded release deterministic initial output, a distinctive bloom, precise area/angle semantics, and direct color control. Existing Recharts use is preserved for the existing language section. The tradeoff is responsibility for geometry, accessibility, responsive labels, and regression testing.

This does not preclude a focused D3 geometry module or a separately loaded Plotly/ECharts renderer later. Such a renderer must have real compatible public data first, a screenshot-friendly initial state, a mobile/performance budget, reduced-motion behavior, and an accessible/static fallback. The research document compares those alternatives in detail.

Known limits: only two datasets and six chart types; no arbitrary uploaded data; no time windows; no persisted category-to-color identity mapping beyond the current ordered row colors; eight displayed rows; six visualization instances; custom category colors can follow a different language if ranks change later. Empty charts remain honest empty-state sections rather than inventing illustrative preview data.

## Validation record

All requested application checks completed successfully. SQL and browser checks were run against isolated local fixtures; production verification remains an operator rollout step.

| Check | Result |
| --- | --- |
| `npm test` | **320 passed across 13 test files.** |
| Targeted `tests/visualization.test.ts` | **97 passed**; configuration/compatibility, palette safety, adapters/privacy, rounding/grouping, area geometry, signed edge cases, SSR titles, and cross-runtime geometry serialization. |
| `npm run lint` | Passed. |
| `npx --no-install tsc --noEmit` | Passed. |
| `npm run build` | Passed for all application routes after removing the temporary browser fixture. |
| `git diff --check` | Passed. |
| SQL tests | Passed on isolated PGlite PostgreSQL 18.3: six migrations; `extension_identity.sql`, `profile_sync.sql`, `profile_layout.sql`, `profile_visualizations.sql`; the full production verifier; 28 adversarial ACL/RLS scenarios; and a real pre-upgrade v1 profile preservation check including timestamps, validator OID, and CHECK dependency. |
| Browser interactions/screenshots | Chromium checks passed for actual-data style/compatibility choices, presets/custom contrast warnings, chart-specific color controls, three independent instance IDs, reorder/hide/width/restore, 390px layout, mocked save error/retry/reload, public/owner/privacy/future-version behavior, removal and cancellation. The final full run had no React console errors or page errors. |

The repository's Docker-based `npm run test:db` path could not run because no Docker daemon was available. A disposable PGlite PostgreSQL engine was used for SQL validation; this is not a hosted Supabase execution or hosted Auth E2E. Production was not contacted, changed, pushed, or deployed by this task.

Browser checks found and corrected a native color-input change sequence that hid the low-contrast warning and a Node/Chromium last-bit SVG geometry difference during hydration. Save/reload checks used a local test fixture and mocked persistence, not a production account. Physical-device checks remain part of operator review.

Session screenshots, stored outside the repository:

- [Public desktop profile](/private/tmp/stack-stats-visualizations/public-desktop.png)
- [Mobile preview](/private/tmp/stack-stats-visualizations/preview-mobile.png)
- [Chart style picker](/private/tmp/stack-stats-visualizations/style-picker-desktop.png)

## Exact files changed

Application:

- `src/lib/visualization.ts` — dataset/config/renderer/appearance definitions and adapters.
- `src/lib/profile-layout.ts` — v1/v2 layouts and repeatable visualization operations.
- `src/components/profile/visualizations/visualization-chart.tsx` — six SVG charts.
- `src/components/profile/visualizations/visualization-editor.tsx` — data/style/color controls with actual-data previews.
- `src/components/profile/visualizations/visualization-section.tsx` — public presentation and values table.
- `src/components/profile/profile-layout-editor.tsx` — repeatable instance editing and creation.
- `src/components/profile/profile-modules.tsx` — public module rendering.
- `src/components/profile/profile-section-picker.tsx` — creation and restore choices.
- `src/components/profile/sortable-profile-section.tsx` — instance identities and display labels.

Database and tests:

- `supabase/migrations/20260925000000_profile_visualizations.sql` — additive v1/v2 validator migration.
- `supabase/verify-production.sql` — read-only visualization schema/compatibility checks alongside existing security assertions.
- `supabase/tests/profile_layout.sql` — existing layout test compatibility.
- `supabase/tests/profile_visualizations.sql` — visualization layout/permission tests.
- `tests/profile-layout.test.ts` — version-boundary expectations.
- `tests/profile-presentation.test.tsx` — future-version presentation expectations.
- `tests/profile-visualizations.test.tsx` — instance, public rendering, privacy, and picker integration.
- `tests/visualization.test.ts` — model, color, dataset, geometry, and SSR coverage.

Documentation:

- `docs/visualization-research.md`
- `docs/visualization-data-inventory.md`
- `docs/visualization-system.md`

The temporary browser fixture under `src/app/u/viz-fixture` was removed before the final build, and the local development server was stopped. No package manifest/lockfile, extension repo, auth flow, sync API, or telemetry contract is part of this change.

## Manual verification

Use your real profile route after the operator rollout below:

1. As owner, visit `/u/<username>?customize=1`. Add all six chart styles across multiple modules, change the two datasets, try every palette and custom colors, reset colors, and confirm live previews use your values.
2. Drag and use keyboard arrows; hide/restore an instance; switch half/full width; remove an instance. Confirm restoring one preserves its style and colors. Confirm the seventh visualization is unavailable while six exist, including hidden instances.
3. Save, reload, and revisit `/u/<username>` signed out. Confirm order, size, colors, values, and source wording persist; no edit controls appear. Also visit `/u/<username>?customize=1` signed out to confirm the query does not grant ownership.
4. Repeat at a narrow phone width and on a physical touch device. Check label wrapping, scrolling, controls, focus, and drag/arrow fallbacks. Zoom text and navigate through the values table with assistive technology where available.
5. On an existing manual profile, check its saved layout/values remain intact. Verify incomplete shares show Unspecified, zero/empty data shows an explanation, and negative code-change balance retains its sign.
6. On a synced profile with language publication disabled, confirm saved manual language values are not revealed by any chart. Review existing publication controls at `/settings/sync`; the visualization flow should not change them.
7. Confirm Cancel leaves the saved profile unchanged and Reset affects the draft until Save. Existing profile details and appearance controls should behave as before.

## Operator rollout: migration, verification, then web release

These are instructions for the operator. No push, deployment, or production SQL execution has been performed by this task.

1. Review the diff and validation results. Keep the existing production web release running while applying the backwards-compatible database migration.
2. In the intended Supabase project's **SQL Editor**, open a new query and paste the **entire contents**, from `begin;` through `commit;`, of [20260925000000_profile_visualizations.sql](../supabase/migrations/20260925000000_profile_visualizations.sql). Run it once using the normal migration/admin role. It assumes the previously applied `20260924000000_profile_layout.sql` migration is present. Do not reapply earlier migrations and do not edit grants or RLS to work around a failure.
3. Open a separate SQL Editor query and paste the **entire updated** [supabase/verify-production.sql](../supabase/verify-production.sql), including `begin read only;` and the final `rollback;`. Run it. Do not run only its new visualization fragment; the full file also verifies the existing auth, sync, profile RLS, role, save-RPC, and timestamp constraints.
4. Expected outcome: no failed assertion, the notice `Auth/sync/layout/visualization schema, RLS and grants passed. Verify migration history and run the browser/editor E2E separately.`, then the role/ACL diagnostic rows. Hosted `anon` table DML grant booleans may be true; the verifier separately proves effective denial through RLS. Do not weaken RLS or permissions to make diagnostics look different.
5. Record the migration through the project's normal migration-history process before future CLI-managed migrations; SQL Editor execution alone is not proof that a separate migration ledger was updated. If an assertion fails, stop the release and inspect the failure before publishing the new web build.
6. After verification passes and the code is approved, commit/push the web release using the commands below, then use the existing deployment workflow. If pushing `main` automatically deploys, **complete the migration and SQL verification before pushing**.
7. Perform the manual checks above against the deployed profile. Public date/history/relationship endpoints are not required and must not be added as part of this rollout.

On macOS, these optional local commands copy the exact SQL files for the two separate SQL Editor runs; they do not execute SQL:

```bash
pbcopy < supabase/migrations/20260925000000_profile_visualizations.sql
```

After that migration query succeeds:

```bash
pbcopy < supabase/verify-production.sql
```

### Rollback

If the web release must be rolled back, keep the additive database migration and saved v2 JSON intact. The previous client understands v1, falls back for unsupported v2 presentation, and refuses editing those future layouts. This temporarily loses visualization presentation in the old web version but avoids destructive overwrites. Restore the updated web client when ready.

Do not “roll back” by deleting `profile_layout`, resetting owner layouts, rewriting v2 to v1, or replacing the dispatcher with a v1-only validator while v2 rows exist. Those actions would lose configuration or leave persisted rows incompatible with validation. A database downgrade would require a separate, explicitly designed data migration and is outside this release.

## Exact commit and push commands

Run after reviewing the completed checks and changes. The temporary fixture has been removed. The branch inspected for this work is `main`.

```bash
git add \
  src/lib/visualization.ts \
  src/lib/profile-layout.ts \
  src/components/profile/visualizations/visualization-chart.tsx \
  src/components/profile/visualizations/visualization-editor.tsx \
  src/components/profile/visualizations/visualization-section.tsx \
  src/components/profile/profile-layout-editor.tsx \
  src/components/profile/profile-modules.tsx \
  src/components/profile/profile-section-picker.tsx \
  src/components/profile/sortable-profile-section.tsx \
  supabase/migrations/20260925000000_profile_visualizations.sql \
  supabase/verify-production.sql \
  supabase/tests/profile_layout.sql \
  supabase/tests/profile_visualizations.sql \
  tests/profile-layout.test.ts \
  tests/profile-presentation.test.tsx \
  tests/profile-visualizations.test.tsx \
  tests/visualization.test.ts \
  docs/visualization-research.md \
  docs/visualization-data-inventory.md \
  docs/visualization-system.md

git commit -m "Add customizable profile visualizations"
```

After the migration verification passes and the release is approved:

```bash
git push origin main
```
