# Phase 9D — visual identity and interactive activity fingerprint

Implemented against `PHASE-9B-SYNC.md`, `PHASE-9C-PROFILES.md` and
`STACK-STATS-WEBSITE-VISUAL-DIRECTION.md`. The starting tree was clean at
`d4ea491`. This phase is presentation only: no migration, SQL, RPC, API route,
sync protocol, publication rule or telemetry changed. No push or deployment.

## 1. Audit of the pre-9D presentation

- **Homepage** (`src/app/page.tsx`, one server component, `force-dynamic`):
  centred serif headline “Your development. One profile.”, one supporting line,
  a blue CTA plus “View @fil”, then an “Example profile” block bordered top and
  bottom. Nav/footer used `max-w-6xl` (1,152px) with no rails; the profile frame
  is 1,080px, so nothing aligned across pages. No data visualization in the hero.
- **Example block** read `fil`'s raw `profiles` row and `profile_languages`
  directly, *not* the approved public projection `/u/fil` uses. For a
  v2-published account the homepage could show manual totals the public
  profile deliberately withholds (“Not published”).
- **Anonymous vs signed-in**: same page; only nav buttons and CTA wording
  change. No private data was read.
- **Profile shell** (Phase 9C): 1,080px `.profile-frame`, outer rails, six
  columns ≥768px, full/two-thirds/half/third spans, shared section rules. The
  rails stopped at the nav. Dataset line/histogram SVGs used `w-full` on a
  510×265 viewBox, so axis text scaled to ~28px in full-width sections.
- **Typography/colour**: Georgia serif (headings), system sans (body),
  SFMono stack (labels/metrics); `#11110d` background, `#edeae0` text, muted
  `#969287/#aaa69a`, rules `#24241f/#2b2a24`, accent `#55a7ff`. Kept as is.
- **Charts**: static SVG renderers (Phase 9C) plus the legacy Recharts donut.
  No animation dependency; reduced motion already disabled transitions.
- **Data available**: public projection has 24 *aggregate* UTC hour bins
  (`schedule.hourly_utc`). The owner-only `GET /api/v2/sync/datasets?dataset=
  hourlyUtc` (session-authenticated, `no-store`, database-scoped to the owner)
  returns real date × UTC-hour rows. No public day × hour matrix exists.
- **Bundle**: homepage loaded 366.5KB gzip of JS (measured in a production
  build, see §16).

Reused: palette, serif/mono pairing, CTA/link styles, `Avatar`,
`getProfileMetrics`, `formatMetricValue` semantics, the Phase 9C frame geometry,
the example persona, and the existing owner dataset API.

## 2. Design direction implemented

“Precision vs. personality”: a rigid 1,080px/6-column coordinate system, a few
hand-drawn marks on precise typography, and developer activity as the only
decoration. Hierarchy is content → fingerprint → annotations → grid. The still
frame is a complete editorial page; interaction adds a computational layer.
No gradients, glass, glow, particles, rounded card grids or new fonts.

## 3. Homepage architecture

`page.tsx` (server) loads the viewer and the example profile, then renders
`HomeView` (server, presentational, directly testable). Client islands:
`HomeFingerprint` → `ActivityFingerprint`, plus existing `Avatar` and
`LogoutButton`. One structure serves every visitor.

1. **Hero** — headline, lede, CTAs, Fig. 01 activity fingerprint.
2. **01 Capture** — “Development activity, captured quietly.” Four-stage
   editor → daily aggregate → private sync → your selection diagram on the
   column grid; “Uploaded as daily aggregates” vs “Never uploaded” lists taken
   from the consent screen’s wording.
3. **02 Measure** — the same 30 days resolved into a readable UTC day × hour
   matrix, with statistics computed from that dataset and labelled as such.
4. **03 Profile** — the live `@fil` profile through the public projection, or
   the labelled example persona.
5. **04 Proof** — “Show real work, not just resume claims.” + CTA and three
   privacy facts (private by default, metric-by-metric, revocable).
6. **Footer** on the same frame.

Anonymous: “Create your profile”. Signed in: “View your profile”/“Set up your
profile” and an explicit owner control on the fingerprint. Server markup never
contains private data. `loadHomeExample` uses `applyPublicProjection`
(extracted unchanged from `/u/[username]`) so the homepage shows exactly what
`/u/fil` shows; on any error it falls back to the example persona.

## 4. Hero composition

Left-aligned headline (`clamp(2rem, 9.6vw, 6.4rem)`, one line per sentence down
to 320px). “development.” is bracketed by two hand-drawn braces like a code
block. “profile” is circled by an overshooting loop carrying three node dots
(“many data points, one object”). Both draw in once after load. The lede and
CTAs occupy columns 1–2. The fingerprint stage starts one column in, rises
8rem into the headline’s open right side, and bleeds past the right rail toward
the viewport edge; its caption stays on the grid. Below 900px it stacks and
spans the viewport with a taller aspect.

## 5. Structural grid

`src/components/ui/structure.tsx` + CSS tokens (`--rule`, `--rule-strong`,
`--rule-faint`, `--frame-max`, `--gutter`):

- `.site-frame`: the profile frame’s exact geometry (1,080px, `calc(100% -
  2rem)`, 1px `--rule` rails).
- `RuleSection`: full-bleed bottom rule, framed content, optional column
  guides and registration crosshairs where rails meet the rule.
- `ColumnGuides`: six faint guides (≥768px), used only in the hero and closing
  section so they run through whitespace, not body text.
- `.site-grid`: six columns; sections split 2 + 4 with a vertical rule instead
  of cards.
- `AppNavbar`: now shares the 1,080px frame on every page; `rails` continues
  the frame through navigation (homepage, profiles). Verified pixel-aligned
  with `.profile-frame` in the browser harness.

## 6. Annotation system

`src/components/annotations/sketch.tsx`: `Annotated` (anchor, no layout
impact), `SketchBrace` (left/right), `SketchNodeLoop`, `SketchUnderline`,
`SketchArrow` (right/down) and the precise `Crosshair`. Inline SVG with
hand-authored paths, `aria-hidden`, `focusable=false`, `pointer-events:none`,
`vector-effect: non-scaling-stroke`, `pathLength=1`. Tone is `pen` (accent
blue) or `pencil` (muted). Draw mode is `load` (one-shot, delayed), `view`
(scroll-linked via `animation-timeline: view()` where supported, otherwise
drawn), or `none`. All draw-in lives inside `prefers-reduced-motion:
no-preference`. Deterministic, no randomness, no hydration-sensitive values.

Density across the whole homepage: 5 marks (hero braces + loop, “quietly”
underline, one arrow on the matrix’s busiest hour). The matrix arrow is static
because a view timeline cannot run inside its horizontal scroller. Profiles
get only structural crosshairs, never marks on user content.

## 7. Activity fingerprint design

`ActivityFingerprint` (client component, SSR-rendered):

- 30 ridges, oldest at the back (top, shifted right), newest at the front.
- One `<path>` per ridge fills with the background and strokes the line, so
  front ridges occlude the ones behind them (hidden-line ridgeline).
- Thin non-scaling strokes shaded back → front `#33322c` → `#d4d0c4`
  (integer colour mixing).
- One accent ridge in Stack Stats blue: the busiest day at rest, the
  hovered/selected date during interaction. Beneath it, a blue stipple layer
  whose dot columns are the exact bin heights (line + stipple hybrid).
- Hour ticks every hour, labels 00/06/12/18/24h and a blue “UTC”; a dotted
  depth axis connects the ridge ends, labelled with the first and last dates.
- Caption: legend (ridge = one UTC date · x = hour of day, UTC · height =
  coding time · front = most recent), provenance note, live readout, and a
  values disclosure (per-date table; full 30×24 matrix rendered on demand).

`FingerprintMatrix` (server) is the readable companion: one path per intensity
level, zero markers, unavailable rows dotted, “no record” rows labelled.

Pure geometry lives in `src/lib/activity-fingerprint.ts`: `buildFingerprint`,
`fingerprintFrame`, `ridgePath`, `stipplePath`, `nearestRidge`, the layouts,
the labels and the representative dataset. It has no React or DOM dependency,
so share cards, OG images, weekly summaries and recaps can reuse it
(`compactLayout` is provided).

## 8. Exact fingerprint data semantics

| Aspect | Rule |
| --- | --- |
| Date range | Every calendar date from `from` to `to`, inclusive. Homepage example: fixed 2026-08-31 → 2026-09-29, labelled day 01–30. Owner view: the API response’s `from`/`to` (period 30, `to` = server UTC date). |
| Hours | `telemetry-v2` UTC bins. Labelled UTC everywhere; never converted, never relabelled local. |
| Amplitude | `activeMsByHour`: evidence-backed active ms per UTC hour (“coding time”). The model accepts other measures explicitly; none is chosen silently. |
| Missing date | No row → `missing`: empty slot with two end ticks, table “No record”, readout “not measured zero”. Never zero-filled. |
| Null history | Row with `hourlyUtc: null` → `unavailable`: dotted baseline, “Hourly data unavailable”. |
| Observed zero | 24 zero bins → `observed`, flat solid line, “Observed zero”. |
| Normalization | Linear, one global maximum over every observed bin in the window. Maximum 0 → all flat, no division. |
| Clipping/smoothing | No value clipping, smoothing or rebinning. Curves pass exactly through each bin centre using monotone cubic (Steffen) interpolation: no overshoot, never below baseline. Each day is anchored to the baseline at 00:00 and 24:00 UTC. Stipple and matrix levels quantize *display* only; tables show exact values. |
| Overlap | Amplitude (150) exceeds ridge spacing (~13), so peaks overlap and occlude by design; exact values stay in the readout and tables. |
| Maximum ridges | 30 (`DEFAULT_MAX_RIDGES`). The most recent dates are kept; older inputs are counted in `omittedDays`, never merged. |
| Short history | One date renders a single front ridge. An empty window renders no ridges and says so. An owner with no observations sees a message and the example remains. |
| Validation | Invalid dates, duplicate dates, and non-24/negative/non-finite bins throw instead of being repaired. |
| Interaction | Deformation is temporary and visual only. Readouts always report exact, undeformed values. |

## 9. Rendering technology

**Server-rendered SVG + a small client enhancer. No new dependency.**
30 ridges × 26 points is trivial for SVG. SSR gives a complete still frame, a
no-JS render, a screenshot-stable composition and native accessibility.
Canvas would have needed a client-only swap with no server image, and extra
accessibility work. WebGL/Three.js (~150KB+) buys nothing at this geometry.
D3 was unnecessary: monotone interpolation is ~25 lines. Non-scaling strokes and
percentage-positioned HTML labels let the stage change aspect (taller on
phones) with `preserveAspectRatio="none"`, without distorting lines or dots.
Coordinates use only IEEE-exact arithmetic and are serialized to 2 decimals;
the example dataset uses integer-only generation (`mulberry32`). Server and
client markup are byte-identical.

## 10. Interaction behaviour

- **Pointer proximity** (mouse/pen): the nearest ridge becomes the accent and
  shows a crosshair and exact readout. Nearby ridges lift (Gaussian gain ≤1.34
  over ridge distance and hour distance).
- **Horizontal movement**: each ridge’s focus hour follows the pointer with a
  rate that falls off with depth distance, so a wave propagates through
  consecutive days.
- **Vertical movement**: skew (perspective) shifts by at most ±10%, centred on
  the resting footprint.
- **Keyboard**: the stage is focusable. Up/Down move between dates,
  Left/Right between hours, Home/End jump to 00/23, Escape resets. The readout
  is `aria-live`.
- **Touch**: a tap highlights the nearest date and hour statically;
  `touch-action: pan-y` keeps scrolling native.
- **Owner**: “Show my last 30 days” fetches the existing owner endpoint on
  explicit request and swaps the model, which re-runs the one-shot rise.
  “Show example data” reverts.
- **Not implemented** (deliberately): drag rotation and scroll-linked
  morphing. The “resolve into a readable chart” idea is the static matrix in
  §02.

## 11. Reduced motion

`prefers-reduced-motion: reduce`: no ridge rise, no annotation draw-in, no
deformation, no animation loop (verified by counting frames). The same static
ridgeline, marks, readout, keyboard/tap selection and tables remain, so no
information is lost. Changing the OS setting mid-session settles immediately.

## 12. Mobile behaviour

The headline stays on two lines at 320–390px. The fingerprint spans the
viewport, crossing the rails, at a taller aspect (1000:820 under 640px,
1000:720 under 900px). The stipple layer and fine tick detail are dropped
under 640px (the tables keep every number). No deformation on touch; taps
select. The matrix keeps a 520px minimum inside its own horizontal scroller.
Pen strokes thin to 1.5px. No page-level horizontal overflow at 320, 390 or
820 (asserted).

## 13. Accessibility

- One `h1`, `h2` per section.
- Fingerprint: `role="img"` with `<title>`/`<desc>` summarizing the window and
  its missing/unavailable/zero counts plus the busiest UTC hour. The
  focusable `role="group"` has instructions, an `aria-live` readout, a
  per-date values table and an on-demand full hourly matrix.
- The matrix has a summarizing `aria-label`.
- Every annotation, crosshair and axis label layer is `aria-hidden`; the
  language strip in the example has a text alternative.
- Nothing depends on hover. Focus-visible outlines, 44px control targets, and
  the existing contrast-checked palette.

## 14. Profile visual changes

No change to v1/v2/v3 semantics, the editor, publication or content modules.

- Navigation rails continue into the profile frame.
- A mono metadata strip (“Developer profile” or “Example profile ·
  representative data”, plus `/u/username`) matches the homepage profile block
  and replaces the old blue left-border example label.
- Registration crosshairs mark where the header rule meets the rails.
- Dataset line/bar/histogram SVGs cap at 340px high, left-aligned, so axis
  text stays near its design size in wide sections.
- `/example` uses the shared example persona. The Phase 9C browser harness
  passes unchanged.

**Future fingerprint hook**: the `DataShape` doc comment in
`src/lib/profile-content.ts` lists the exact steps.

1. An approved public day × hour projection with schedule consent, and its
   SQL allowlist.
2. A `profileDatasets` entry adapting it to `FingerprintInputDay[]`.
3. A `waterfall` renderer that renders `ActivityFingerprint`.

The v3 module/config shape does not change. A test asserts nothing claims
`utc-day-hours` today.

## 15. Public/private data boundary

- Homepage server render: only `profiles`, `profile_languages` and the public
  RPCs `sync_public_profile_v2`/`sync_public_profile` (tested).
- Owner fingerprint: client-only `fetch` of the unchanged owner endpoint,
  started by an explicit click (`cache: no-store`, same-origin credentials).
  Strictly validated by the lazy-loaded `privateDataset`. Held only in page
  memory, labelled “Only you can see this view”, never stored, published or
  passed to a profile. The browser harness asserts no request happens before
  the click.
- Public profiles: unchanged projections. Tests assert that no public route,
  profile component or profile library references the owner loader, the
  datasets endpoint or private RPCs, and that published hourly bins still
  render only the existing heatmap.

## 16. Performance

Production builds of `HEAD` and Phase 9D, loaded in Chrome, summing script bytes
actually downloaded:

| Route | Baseline JS (gzip) | Phase 9D JS (gzip) | Δ |
| --- | --- | --- | --- |
| `/` | 366.5KB (13 scripts) | 374.8KB (14 scripts) | +8.3KB |
| `/example` | 362.4KB | 363.2KB | +0.8KB |

- CSS: +2.5KB gzip (8.8 → 11.4KB).
- The zod validator for owner data is a separate lazy chunk, fetched only on
  the owner’s click.
- DOM: homepage 553 nodes, fingerprint SVG 66 nodes; `/example` 164 → ~175.
- rAF runs only while something moves. Values snap once visually settled,
  ridges beyond 8 dates snap immediately, and a still pointer schedules no
  frames. Harness asserts ≤2 frames/second idle, after settling, and while
  held.
- Work stops off-screen (IntersectionObserver) and when the tab is hidden.
- Zero long tasks during a 25-step pointer sweep in dev mode.
- Local FCP on `/` is dominated in both builds by the unreachable test
  Supabase host (~7s timeout), so it is not a design measurement.

## 17. Exact files changed

Modified:

- `src/app/example/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/u/[username]/page.tsx`
- `src/components/profile/profile-content.tsx`
- `src/components/profile/profile-view.tsx`
- `src/components/ui/app-navbar.tsx`
- `src/lib/format.ts`
- `src/lib/profile-content.ts`

Added:

- `docs/PHASE-9D-VISUAL-IDENTITY.md`
- `scripts/test-phase9d-browser.mjs`
- `src/components/annotations/sketch.tsx`
- `src/components/fingerprint/activity-fingerprint.tsx`
- `src/components/fingerprint/fingerprint-matrix.tsx`
- `src/components/home/example-profile.tsx`
- `src/components/home/home-fingerprint.tsx`
- `src/components/home/home-view.tsx`
- `src/components/ui/structure.tsx`
- `src/lib/activity-fingerprint.ts`
- `src/lib/example-profile.ts`
- `src/lib/owner-fingerprint.ts`
- `src/lib/public-profile.ts`
- `tests/activity-fingerprint.test.ts`
- `tests/fingerprint-component.test.tsx`
- `tests/fixtures/home-preview.tsx`
- `tests/homepage.test.tsx`
- `tests/phase9d-boundaries.test.tsx`

## 18. Tests added

53 new unit tests (645 → 698); no existing test was modified.

- `tests/activity-fingerprint.test.ts` (22): missing/unavailable/zero
  distinction, explicit windows, the ridge cap with `omittedDays`, global
  linear normalization, all-zero, one-day and empty history, malformed input,
  UTC labels, private-row mapping, deterministic fixed-precision geometry, no
  overshoot and exact bin points, depth order and bounds, centred skew,
  stipple exactness, nearest-ridge picking, and the representative dataset
  and its summary.
- `tests/fingerprint-component.test.tsx` (17): identical repeated SSR markup
  with no `Math.random`, accessible name/description/readout/tables, distinct
  status marks, selection wording, depth colours, reduced-motion CSS scoping,
  matrix output, annotation `aria-hidden`/determinism/classes/no text, and
  owner loader endpoint/options/status mapping/validation/network failure.
- `tests/homepage.test.tsx` (8): anonymous story, signed-in personalization,
  no private reads during render, live example via the public projection
  (manual value withheld), persona fallback, structural classes and
  annotation density, repeat-render stability, and copy tied to the consent
  contract.
- `tests/phase9d-boundaries.test.tsx` (6): no public `utc-day-hours` claim,
  no owner loading in public sources, no fingerprint in public profiles, nav
  rails and marks, legacy sections intact, example labelling, and the chart
  scaling cap.
- `scripts/test-phase9d-browser.mjs`: Chrome harness covering hydration and
  console errors, static composition, deformation and exact restore, idle,
  held and settled frame counts, keyboard, the values matrix, off-screen
  pause, reduced motion, 390/320/820 overflow and touch, owner explicit load,
  exact endpoint, missing/unavailable ridges, 403 fallback, and nav/profile
  rail alignment. It creates and removes its own temporary route.

## 19. Validation results

| Check | Result |
| --- | --- |
| `npm test` | 20 files, 698 tests passed |
| `npm run lint` | Passed |
| `npx --no-install tsc --noEmit` | Passed |
| `npm run build` | Passed; no fixture route in the manifest |
| Phase 9D browser harness | All sections passed (Chrome, synthetic data, mocked owner API) |
| Phase 9C profile browser harness | Passed: editor, drag (pointer/keyboard/touch), publication/schedule consent, hide/restore, remove/undo, save failure/retry, low data, legacy, mobile |
| Database tests / production verifier | Not run: no DB, RPC or privacy change in this phase |
| `git diff --check` | Passed |

Run the harnesses with no other `next dev` in this directory, before the
production build:

```sh
STACK_STATS_PLAYWRIGHT_PATH=/private/tmp/stack-stats-ui-check/node_modules/playwright/index.mjs \
  node scripts/test-phase9d-browser.mjs
STACK_STATS_SCREENSHOTS=/private/tmp/stack-stats-phase9d/profile \
STACK_STATS_PLAYWRIGHT_PATH=/private/tmp/stack-stats-ui-check/node_modules/playwright/index.mjs \
  node scripts/test-profile-content-browser.mjs
```

## 20. Screenshots (local, synthetic, not committed)

`/private/tmp/stack-stats-phase9d/`:

- `home-desktop.png`
- `home-desktop-fold.png`
- `home-tablet.png`
- `home-mobile.png`
- `home-mobile-320.png`
- `hero-reduced-motion.png`
- `fingerprint-closeup.png`
- `fingerprint-interaction.png`
- `home-authenticated-owner.png`
- `example-profile-desktop.png`
- `example-profile-mobile.png`
- `profile/profile-desktop.png`
- `profile/profile-mobile.png`
- `profile/profile-editor.png`
- `profile/profile-low-data-mobile.png`

## 21. Known limitations

- Owner view: fixed 30-day window, coding-time measure only, not remembered
  across visits, and `to` follows the server’s UTC date.
- `/u/fil` data drives the homepage example only when reachable; otherwise the
  labelled persona is shown. The homepage now performs the same one or two
  public-projection RPCs as a profile view.
- The scroll-linked underline draw-in needs `animation-timeline` support;
  elsewhere it is simply drawn.
- The matrix scrolls horizontally inside itself on phones.
- Georgia/SFMono remain system fonts; rendering varies slightly by platform.
- Tested only in headless Chrome with device emulation. Safari, Firefox,
  physical touch devices and screen readers remain manual follow-up.

## 22. Deferred

- Public day × hour publication contract and the profile `waterfall` renderer.
- Share cards/OG images, weekly summaries and annual recaps (the geometry is
  ready).
- Drag rotation and a scroll-linked hero→chart morph.
- A single-ridge rendering of published 24-bin aggregates on the homepage
  example.
- Measure selector for the owner view.
- Image uploads (per Phase 9C).

## 23. Database, API and privacy changes

None. No migration, SQL, RPC, grant, RLS, API route, sync protocol, consent or
publication change. `applyPublicProjection` is a verbatim extraction of the
existing `/u/[username]` calls (same RPCs, order and fail-closed behaviour; the
route tests pass unchanged). The homepage example now reads through it instead
of reading the raw manual row.

## 24. Staging block

Provided for review; not executed. No push or deploy.

```sh
cd /Users/fstopyra/Desktop/stack-stats/stack-stats-web
git diff --check
git add -- \
  docs/PHASE-9D-VISUAL-IDENTITY.md \
  scripts/test-phase9d-browser.mjs \
  src/app/example/page.tsx \
  src/app/globals.css \
  src/app/page.tsx \
  'src/app/u/[username]/page.tsx' \
  src/components/annotations/sketch.tsx \
  src/components/fingerprint/activity-fingerprint.tsx \
  src/components/fingerprint/fingerprint-matrix.tsx \
  src/components/home/example-profile.tsx \
  src/components/home/home-fingerprint.tsx \
  src/components/home/home-view.tsx \
  src/components/profile/profile-content.tsx \
  src/components/profile/profile-view.tsx \
  src/components/ui/app-navbar.tsx \
  src/components/ui/structure.tsx \
  src/lib/activity-fingerprint.ts \
  src/lib/example-profile.ts \
  src/lib/format.ts \
  src/lib/owner-fingerprint.ts \
  src/lib/profile-content.ts \
  src/lib/public-profile.ts \
  tests/activity-fingerprint.test.ts \
  tests/fingerprint-component.test.tsx \
  tests/fixtures/home-preview.tsx \
  tests/homepage.test.tsx \
  tests/phase9d-boundaries.test.tsx
git diff --cached --check
git diff --cached --stat
git diff --cached
```

## 25. Commit command

```sh
git commit -m "Add Stack Stats visual identity and interactive activity fingerprint"
```
