# Phase 9D.1 — homepage simplification, fingerprint interaction, profile cards

> **Superseded in part by [Phase 9D.2](PHASE-9D2-HOMEPAGE.md):** the card stack
> is now four cards with a coordinated fan, band-based selection, focus and
> click lock (§4); the hero adds a VS Code entry path; the structural grid
> gains proximity and ambient signals. Fingerprint behaviour (§5–7) is
> unchanged.

A focused polish pass on `219ea15` (Phase 9D). No change to database schemas,
SQL, RPCs, API routes, sync protocol, publication or privacy semantics, or
profile layout v3 behaviour. The profile editor and public profile are
untouched apart from a compact avatar size option used only by homepage cards.
No push or deployment.

Principle: **show, don't explain.** The name, headline, profile cards,
statistics and the fingerprint should say “this tracks my coding and gives me a
profile” within seconds.

## 1. Removed

- **01 Capture**: the four-step editor → aggregate → sync → selection diagram,
  and the “Uploaded as daily aggregates” / “Never uploaded” lists. That detail
  remains in the consent screen, Sync settings and docs.
- **04 Proof**: the resume/README paragraph, its CTA and the three privacy
  facts.
- **02 Measure** as written: explanatory paragraphs, the day × hour matrix
  (`fingerprint-matrix.tsx` deleted), the matrix arrow and the “derived from”
  note. Its useful core (four statistics) moved into the new Activity section.
- **Hero annotations**: the loop around “profile” and the underline under
  “quietly”. The braces around “development.” remain as the hero's only
  annotation.
- **Fingerprint chrome**: the legend (“RIDGE = ONE UTC DATE …”), the
  representative-data sentence, “Highlighted: busiest day…”, the visible
  “Values by date (UTC)” disclosure and its full hourly matrix.
- **Interaction defects**: the stack-wide cursor line and the whole-ridge blue
  highlight.
- **Flat embedded profile preview** (`example-profile.tsx` deleted) and
  numbered section labels.

## 2. New homepage structure

1. **Hero**: “Your {development}. One profile.”; one sentence (“Stack Stats
   tracks your coding in VS Code and turns it into a profile you can share.”);
   primary CTA plus the live-profile link; an overlapping stack of profile
   cards.
2. **Activity**: label, “Your work leaves a pattern.”, one line (“Every ridge is
   one day of coding, hour by hour.”), four statistics on the column grid,
   then the full-width interactive fingerprint with a one-line caption and a
   small owner-only control.
3. **Final CTA**: “What does your coding look like?” with the same CTA.
4. **Footer**.

Visible copy is capped by a test (under 420 words). At 390px the page is about
2,150px tall, down from 5,206px.

## 3. Hero: profile cards won

Both arrangements were built and compared at the same widths
(`comparison/hero-cards-desktop.png` vs `comparison/hero-fingerprint-desktop.png`).

- **Cards win on comprehension.** “One profile.” sits next to actual profiles
  with names, coding time, languages and small fingerprints: developer →
  profile → stats at a glance.
- **Fingerprint-first read as abstract art**, and a visitor had to scroll to
  learn what the product is.
- **The waterfall loses nothing.** It becomes the Activity centrepiece at
  larger scale (full frame width, bleeding past the right rail), with no text
  over it.

## 4. Profile-card composition

`src/components/home/profile-cards.tsx`, `src/lib/example-developers.ts`.

- **Five cards.** The front card is the live `@fil` profile, built from the
  same approved public projection as `/u/fil` (`applyPublicProjection`). If
  that profile is unavailable, the front card is the labelled “Alex Rivera”
  example linking to `/example`.
- **Four fictional examples**: Night Owl, Early Bird, Weekend Builder, Sprint
  Coder, with `@example-…` handles. Each is marked “Example profile” and
  “Example”, is an `<article aria-label="Example profile (fictional): …">`, and
  is never a link. Every statistic (coding time, active dates, peak UTC hour)
  and the mini fingerprint derive from that example's own synthetic 14-day
  data; each peaks at a different hour.
- **Content per card**: path strip and tag, avatar/initials, name, handle,
  two-line bio, one large stat, two small stats, a visual and top languages.
  The live card's visual is its published 24-bin UTC hour profile when
  published (a single aggregate ridge, never day × hour), otherwise a language
  bar. Unpublished values never fill slots.
- **Desktop composition**: a fan rising left to right, echoing the ridgeline,
  with the live card at front-right. Rotations −6.5° to +3.2°, deterministic
  offsets, rounded corners, tactile shadows, no gloss or rainbow effects.
- **Grid interaction**: the stack starts at column 3, rises into the open
  space right of “One profile.”, and crosses the right rail. The rise scales
  with viewport width (`clamp(-8rem, 196px − 23.8vw, 0)`), so no card ever
  covers the headline; the browser harness samples the rendered pixels to
  prove it.
- **Scaling**: each card is a scaled object. Internal sizes are in `em` of
  `card-width × 0.046`, so content never reflows or clips from 214px to 268px.
- **Hover/focus (CSS only)**: the card lifts 14px, eases its rotation to 30%,
  and comes forward; its visual neighbours part by a quarter step (`:has()`).
- **Phones and tablets (< 900px)**: a native horizontal scroll-snap strip
  crossing the rails, live card first, rotations reduced to 30%.
- **CTA**: anonymous visitors get “Create your profile →” and “View @fil's
  profile →” (or “View example profile →” in the fallback). Signed-in owners
  get “View /u/{username} →”. The live card itself links to its profile.

## 5. Fingerprint selection: root causes

1. **Cursor line through other ridges.** The cursor group was painted after
   all 30 ridges, so its curve-to-baseline dashed line sat over every ridge in
   front of the selection.
2. **Unexpected jumps and hard-to-select ridges.** Hit-testing chose the
   nearest line by raw vertical distance. It ignored occlusion, so a hidden
   back ridge could win (a unit test now demonstrates this), and it had no
   hysteresis: lines about 13 units apart flipped at the midpoint.
3. **Detached selection.** Hit-testing used resting geometry while the screen
   showed lifted and skewed geometry, and the vertical-skew response moved
   ridges under a still pointer.
4. **Flicker and abrupt blue.** Every selection change was a React state
   update. That unmounted and remounted the stipple in another group and
   swapped a whole-ridge blue class, and one frame rendered resting geometry
   before the animation loop re-applied the deformation.

## 6. Interaction changes

- **No React state in the interaction path.** Pointer, touch and keyboard all
  go through one imperative `select()`. The readout, classes, marks and
  gradient are DOM/SVG mutations. React renders only the server markup.
- **Visible-surface hit-testing** (`visibleRidgeAt`): the frontmost ridge
  whose filled silhouette contains the pointer, computed on the currently
  displayed (deformed, skewed) geometry. Gaps between flat baselines fall back
  to the nearest line.
- **Hysteresis** (`pickRidge`): the current ridge is kept while it is still
  the visible surface within ±0.42 ridge gaps of the pointer. Harness results:
  0 switches under ±3px jitter, and a slow downward sweep advances strictly
  16→17→…→21 with no oscillation.
- **Coalescing**: pointer events are processed once per animation frame. The
  lift's centre glides between dates, so neighbouring ridges respond
  gradually. Vertical skew response is reduced from ±10% to ±4%.
- **Idle**: the loop still stops when settled, when held still, off-screen
  and when the tab is hidden. It restores the exact server geometry on
  settle.

## 7. Cursor and highlight behaviour

- **No cursor line at all.** The marker is a point with a background-coloured
  halo, placed exactly on the curve at the selected hour's bin centre.
- **Marks live inside the active ridge's own `<g>`.** The marker, the accent
  line and the stipple are all inside it, so ridges in front occlude them
  exactly as they occlude that ridge.
- **Brightness, not blue.** The active ridge brightens to off-white (1.25px)
  with a 220ms stroke transition.
- **Blue is local.** It is a gradient window about 3.4 UTC hours either side
  of the pointer that glides with it along the ridge. Stipple appears only
  within ±3.5 hours and fades with the same gradient.
- **Switching** crossfades the live accent (160ms), and the previous ridge
  eases back.
- **At rest**, the busiest day carries the same local accent at its peak
  hour. Engaging crossfades from the rest accent to the live one; leaving
  reverses it.

## 8. Accessibility

- One `h1` and two `h2`s.
- Fingerprint semantics are unchanged: `role="img"` with `<title>`/`<desc>`,
  a focusable group with keyboard exploration (arrows, Home/End, Escape) and
  an `aria-live` readout that shows the short caption at rest. The per-date
  table is now visually hidden (`sr-only`) instead of a visible disclosure.
  Sighted keyboard users reach every date and hour through the readout.
- The owner control is a real button with a descriptive `title` and a 44px
  target. Statuses use `role="status"`.
- Cards: `<ul>` of `<li>`. The live card is one link. Example cards are named
  “Example profile (fictional)”. Language bars have text alternatives, mini
  fingerprints are labelled images, and focus lifts a card the same way hover
  does.

## 9. Mobile

- The headline stays on two lines down to 320px.
- Cards become a swipeable, snapping strip with the live card first. The page
  itself never overflows (tested at 320, 390 and 820px, plus 1024px).
- The fingerprint spans the viewport at a taller aspect.
- A tap selects the nearest date statically; touch never deforms the
  geometry.

## 10. Reduced motion

- No ridge rise, no brace draw-in, no deformation and no loop. At most one
  frame runs per pointer event, never continuous; this is asserted.
- Selection, readout, keyboard and tap still work.
- Card hover changes apply instantly: transitions are disabled globally, and
  nothing depends on the motion.

## 11. Files changed

Modified:

- `docs/PHASE-9D-VISUAL-IDENTITY.md` (superseded-sections note)
- `scripts/test-phase9d-browser.mjs`
- `src/app/globals.css`
- `src/components/fingerprint/activity-fingerprint.tsx`
- `src/components/home/home-fingerprint.tsx`
- `src/components/home/home-view.tsx`
- `src/components/profile/avatar.tsx` (optional `size="card"`; default unchanged)
- `src/lib/activity-fingerprint.ts`
- `tests/activity-fingerprint.test.ts`
- `tests/fingerprint-component.test.tsx`
- `tests/fixtures/home-preview.tsx`
- `tests/homepage.test.tsx`
- `tests/phase9d-boundaries.test.tsx`

Added:

- `docs/PHASE-9D1-HOMEPAGE.md`
- `src/components/home/profile-cards.tsx`
- `src/lib/example-developers.ts`

Deleted:

- `src/components/fingerprint/fingerprint-matrix.tsx`
- `src/components/home/example-profile.tsx`

## 12. Tests

698 → 708 unit tests.

- `activity-fingerprint.test.ts` (+8):
  - visible-surface selection, including the hidden-ridge regression
  - hysteresis keep/switch and a no-oscillation loop
  - markers exactly on the curve
  - local stipple
  - example developers' derived statistics and distinct peaks
  - deterministic synthesis
  - the Phase 9D representative dataset pinned (486,473,000 ms, 10:00 UTC,
    Sep 9)
- `fingerprint-component.test.tsx` (−1): the matrix test was removed. Added:
  short caption plus an `sr-only` table with no legend or disclosure, no
  cursor nodes, the rest accent inside its ridge group, and a local gradient
  instead of whole-ridge blue.
- `homepage.test.tsx` (+3): new story and copy cap, removed sections absent,
  signed-in CTA and owner control, card order/front/live link, examples
  labelled and unlinked, persona fallback, one hero annotation, and
  statistics derived from the displayed model.
- `phase9d-boundaries.test.tsx`: card sources are included in the
  no-private-data scan; owner loading is proven click-only (one call, inside
  the click handler, no effect).
- **Browser harness** (`scripts/test-phase9d-browser.mjs`):
  - Hero: headline pixel clearance, card order, labels and links, card hover.
  - Fingerprint selection: no cursor line, marks inside the active group,
    point marker, jitter stability, a monotonic sweep and a visible-surface
    pick.
  - Motion and idle: deformation and exact restore, frame counts idle, held
    and settled.
  - Keyboard and off-screen pause.
  - Reduced motion.
  - Widths 390, 320, 820 and 1024: overflow, single-line headline, snapping
    card strip, touch.
  - Owner mode: click-only load, exact endpoint, statistics follow the
    owner's data (24/30), 403 fallback.
  - Real-route persona fallback, and profile rail alignment.

## 13. Validation

| Check | Result |
| --- | --- |
| `npm test` | 20 files, 708 tests passed |
| `npm run lint` | Passed |
| `npx --no-install tsc --noEmit` | Passed |
| `npm run build` | Passed; no fixture route in the manifest |
| Phase 9D.1 browser harness | All sections passed (Chrome, synthetic data) |
| Phase 9C profile browser harness | Passed (editor, drag, publication, low data, legacy, mobile) |
| Bundle vs deployed 9D (production, bytes actually downloaded) | `/`: 374.6 → 373.0KB gzip JS, 14 → 13 scripts; `/example` unchanged (363.3KB); CSS +0.6KB gzip |
| DOM | Homepage 553 → 547 nodes; fingerprint SVG 76 nodes |
| `git diff --check` | Passed |
| DB tests / production verifier | Not run: no DB, RPC or privacy change |

## 14. Screenshots (local, synthetic, not committed)

`/private/tmp/stack-stats-phase9d1/`:

- `home-desktop.png`, `hero-closeup.png`
- `home-1024.png`, `home-tablet.png` (820px)
- `home-mobile.png` (390px), `home-mobile-320.png`
- `profile-cards.png`, `profile-cards-hover.png`
- `waterfall-idle.png`, `waterfall-active.png`, `waterfall-reduced-motion.png`
- `reduced-motion.png`
- `home-authenticated-owner.png`
- `comparison/hero-cards-desktop.png`, `comparison/hero-fingerprint-desktop.png`
- `before/*` (the deployed Phase 9D design)
- `profile/*` (Phase 9C harness)

The front `@fil` card in these screenshots uses a synthetic stand-in with
plausible published values, passed through the production adapter; local runs
cannot reach the production profile.

## 15. Known remaining visual issues

- The real `@fil` card shows only what fil actually publishes. With sparse
  publication it may show a single statistic and a language bar instead of
  the hour profile.
- At 1024–1180px the scaled cards' smallest labels are about 7px; stats and
  names stay legible.
- Hysteresis is deliberately strong: selection moves to a neighbouring flat
  ridge when the pointer reaches it, not at the midpoint.
- Near occlusion edges the marker, at the bin centre, can sit behind a front
  ridge. This is physically consistent, but it can hide the dot.
- The brightened rest and active ridge still shows its full length, including
  flat hours; it is softened but visible.
- At 320px, the “24h” and “UTC” axis labels sit close together.
- Card neighbour-spread uses `:has()`; browsers without it simply do not
  spread.
- Tested only in headless Chrome with device emulation. Safari, Firefox and
  physical devices remain manual follow-up.

## 16. Staging

```sh
cd /Users/fstopyra/Desktop/stack-stats/stack-stats-web
git diff --check
git add -- \
  docs/PHASE-9D-VISUAL-IDENTITY.md \
  docs/PHASE-9D1-HOMEPAGE.md \
  scripts/test-phase9d-browser.mjs \
  src/app/globals.css \
  src/components/fingerprint/activity-fingerprint.tsx \
  src/components/fingerprint/fingerprint-matrix.tsx \
  src/components/home/example-profile.tsx \
  src/components/home/home-fingerprint.tsx \
  src/components/home/home-view.tsx \
  src/components/home/profile-cards.tsx \
  src/components/profile/avatar.tsx \
  src/lib/activity-fingerprint.ts \
  src/lib/example-developers.ts \
  tests/activity-fingerprint.test.ts \
  tests/fingerprint-component.test.tsx \
  tests/fixtures/home-preview.tsx \
  tests/homepage.test.tsx \
  tests/phase9d-boundaries.test.tsx
git diff --cached --check
git diff --cached --stat
```

`git add` on the two deleted paths stages their deletion.

## 17. Commit

```sh
git commit -m "Simplify homepage, add profile cards and smooth fingerprint selection"
```
