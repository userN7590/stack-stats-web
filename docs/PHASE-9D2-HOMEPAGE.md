# Phase 9D.2 — card fan, living grid, VS Code entry path

This is the final homepage-specific design pass, on `3ee65e6` (Phase 9D.1).

- The 9D.1 structure is preserved: profile identity in the hero, then the
  activity fingerprint, a short final CTA and the footer.
- The Activity section and fingerprint behaviour are unchanged.
- No change to database schemas, SQL, RPCs, API routes, sync semantics,
  publication or privacy behaviour, or profile layout v3.
- No new dependency. No push or deployment.

## 1. Four cards, not five

Both compositions were compared with the new interaction (`comparison/`):

- `cards-5-rest-1360.png`
- `cards-4-rest-1360.png`
- `cards-5-middle-active-1360.png`
- `cards-4-middle-active-1360.png`

**Four wins:**

- **Larger targets.** Each example exposes about 47% of its width (127px at
  1360px) instead of 41% (110px).
- **Larger cards.** The whole stack can be bigger, so mid-width labels meet
  the 8px goal.
- **Clearer focus.** `@fil` reads as the focal object instead of one card
  among five.

The composition stays a fanned physical stack, not a row of dashboards.

Early Bird was removed. It was the least distinct persona: a daytime
TypeScript front-end rhythm close to the live `@fil` card. The three
remaining examples are Night Owl, Weekend Builder and Sprint Coder: night,
weekends and short bursts. They still show different developer identities
and still peak at different UTC hours.

## 2. Final composition (≥1024px)

- **Fan:** back-left to front-right, rising like the ridgeline: Night Owl,
  Weekend Builder, Sprint Coder, then `@fil`.
- **Rotation:** −5°, −2.4°, +2.2°, −1.2°.
- **Sizes:** card width is `clamp(230px, 20vw, 270px)` and the step is 47% of
  it. `@fil` is 10% wider (297px at 1360px) and rests frontmost (z 5).
- **`@fil` treatment:** a slightly lighter surface, a stronger border
  (`#4a493f`), a deeper shadow and the blue “Live” tag.
- **Placement:** the fan rises into the open space right of “One profile.”
  (`margin-top: clamp(-7.5rem, 170px − 21vw, 0)`) and crosses the right rail.
  The container reserves the spread distance on both sides, so no card is
  ever clipped. The browser harness samples rendered pixels to prove no card
  covers the headline, at rest or with any card active.
- **Scaling:** each card is a scaled object (all sizes in `em` of card width ×
  0.046). The smallest meaningful label is 8.0px at 1024px, 8.25px at 1180px
  and 9.4px at 1360px, up from about 7px.
- **Data:** the live card still uses only the approved public projection.
  The fallback persona remains labelled “Example”.

## 3. Active-card behaviour: one coordinated fan

`src/components/home/card-stack.tsx` is a small client wrapper around the
server-rendered cards. It only writes data attributes; CSS does all motion
(`globals.css`, “one coordinated fan”).

- **Active card:** lifts 14px, eases its rotation to 25% and comes forward.
  Its z-index rises after 90ms, once its neighbours have started to part, so
  it never pops through.
- **Cards behind it** slide back-left by 8% of the card width.
- **Cards in front of it** slide right by 17%, together, revealing it.
- **Easing:** 280ms `cubic-bezier(.22, .78, .24, 1)`, with no overshoot or
  bounce. Z-index drops immediately on deactivation, so the neighbours slide
  back over the card physically.
- **No React state changes on pointer movement.**

## 4. Selection and hysteresis

- **Bands.** Each card owns a band along the stack's x-axis taken from its
  resting position (`offsetLeft`, which ignores transforms). Moving cards can
  never steal the pointer or cause flicker.
- **Hysteresis** (`pickCardBand`, `src/lib/card-stack.ts`): the active card is
  kept while the pointer stays within 16% of a step (about 20px) of its band.
  Beyond that, the card whose band contains the pointer takes over.
- **Coalescing:** pointer moves are processed at most once per animation
  frame. A pointer in empty space between cards keeps the current card.
- **Leaving:** leaving the stack collapses the fan after a 140ms grace period.
- **Harness results:**
  - bands of 127/126/127/297px, each visible at its centre
  - 0 switches during 40 steps of jitter across a boundary
  - a steady sweep activates Night Owl → Weekend Builder → Sprint Coder →
    `@fil`, in order, with no oscillation

## 5–7. Hover, click, focus and mobile

- **Desktop hover** previews a card (sections 3–4).
- **Click on an example** locks it forward (blue edge). A locked card stays
  forward while the pointer explores. Click it again, click outside the stack
  or press Escape to restore the resting fan. Clicking `@fil` opens `/u/fil`.
- **Keyboard:** tab order is `@fil` first (a link), then the three examples,
  which are focusable articles labelled “Example profile (fictional)”. Focus
  previews exactly like hover; Enter or Space locks an example; Escape
  releases.
- **Below 1024px:** a native horizontal scroll-snap strip with `@fil` first.
  There is no hover dependency; a tap emphasises a card (lift, rotation to 0)
  and a second tap releases it. The hero's lede and fan now split at 1024px,
  not 900px, so tablets get the strip instead of a cramped fan.

## 8–9. Structural grid

**Proximity** (`src/components/ui/grid-signal.tsx` plus `globals.css`):

- **One listener.** A single `pointermove` listener on the document; each
  update runs in at most one animation frame.
- **Measurement.** Each update measures only the line-owning elements: the
  outer rails (`.site-frame`, `.nav-rails`), full-bleed section rules
  (`.site-section`, the nav's `.grid-rule`) and the hero's column guides.
- **Writes.** Hosts within 130px get local pointer coordinates as CSS custom
  properties and a `grid-near` class.
- **Rendering.** Each 1px pseudo-element strip (left and right rail, each
  guide, each rule) paints a radial gradient centred on the pointer. So only
  a short segment near the pointer turns lightly blue (`rgba(85,167,255,.5)`
  at the centre, fading to nothing by 130px), and the rest of the same line
  stays neutral.
- **Painting order.** Strips sit above their line and below all content, so
  they never cross cards, text or the fingerprint.
- **When it runs.** Only for a fine pointer with hover and no reduced
  motion. Cleared when the pointer leaves the window or the tab is hidden.
- **No extra DOM nodes.**

**Ambient** (`GridPulse`, `RuleSection rulePulse`):

- Three faint blue-gray pulses (`rgba(128,170,220,.38)`): down the hero's left
  rail (3s offset), along the hero's bottom rule (11s) and down the Activity
  section's right rail (19s).
- Each travels for about 7.8s of a 26s cycle.
- Deterministic delays, no randomness, and compositor-only `transform`
  animation using container-query units.
- Three `aria-hidden` spans in total. Most visitors should barely notice.

## 10. Reduced motion

- No ambient pulses and no proximity response; the static grid remains.
- The card fan still works by focus, click and tap, but its states apply
  instantly (transitions are disabled globally).
- The fingerprint behaves as in 9D.1: static, with selection and readout
  still available.

## 11. Performance

Production builds of `3ee65e6` (9D.1) and 9D.2, loaded in Chrome, summing the
script bytes actually downloaded:

| | 9D.1 | 9D.2 | Change |
| --- | --- | --- | --- |
| `/` JS (gzip) | 372.8KB, 13 scripts | 374.5KB, 13 scripts | +1.7KB |
| `/example` JS (gzip) | 363.1KB | 363.3KB | unchanged |
| CSS (gzip) | 12.0KB | 12.9KB | +0.9KB |
| Homepage DOM | 546 nodes | 527 nodes | −19 (one card fewer; +3 pulse spans) |

- No `requestAnimationFrame` loop: both controllers schedule one frame per
  pointer move at most. The harness asserts no frames while the pointer is
  still over the cards or the grid.
- The ambient signal is CSS-only.

## 12–15. Hero entry paths and the VS Code CTA

**Layout:**

- The primary blue profile CTA keeps its dynamic label: “Create your profile”
  signed out, “View /u/{username}” or “Set up your profile” signed in.
- The VS Code entry sits directly beside it, and the live-profile link drops
  to a quiet tertiary line.
- In the ≥1024px hero the two paths stack in the narrow text column. Below
  1024px, and in the final CTA, they wrap side by side.
- Both are at least 44px tall at every tested width.

**VS Code CTA** (`src/components/home/extension-cta.tsx`):

- An outlined dark treatment with the monochrome VS Code mark, so it never
  competes with the blue primary.
- **Current state: coming soon.** It is a non-interactive note with a dashed
  outline: “VS Code extension · Coming soon — Track locally. Connect your
  account later.” There is no link, so there is no dead or placeholder URL.
- **Why:** the extension manifest has no Marketplace publisher and is
  private; its README says Marketplace publication is not part of the
  current build (installs are from a supplied `.vsix`).
- **Future state:** “Get the VS Code extension — Start tracking now. Connect
  your account later.”, opening the official listing in a new tab.

**Exact config location:** `VSCODE_EXTENSION_URL` in
`src/lib/distribution.ts` (currently `null`).

- Set it to the official listing, e.g.
  `https://marketplace.visualstudio.com/items?itemName=<publisher>.stack-stats-vscode`,
  and both CTAs become active links. No homepage change is needed.
- `extensionInstallUrl` accepts only HTTPS `marketplace.visualstudio.com` or
  `open-vsx.org` listing URLs; anything else keeps the coming-soon state.
- Before release, a new publisher ID also needs the extension callback
  allowlist change in `docs/EXTENSION_AUTH.md`.

## 16. Accessibility

- Heading hierarchy is unchanged (one `h1`, two `h2`s).
- Cards: a list; the live card is a link. Examples are focusable articles
  named as fictional examples. Focus-visible outlines on both. Nothing
  depends on hover.
- The VS Code note is plain text when unavailable. When available it is a
  link that announces “opens the extension listing in a new tab”, and its
  mark is `aria-hidden`.
- Grid strips and pulses are pseudo-elements or `aria-hidden` spans.

## 17. Responsive checks

Tested at 1360, 1180, 1024, 820, 390 and 320px:

- no page overflow and no clipped cards
- a single-line “Your development.”
- entry paths at least 44px tall and inside the viewport
- smallest card label at least 8px
- the fan at ≥1024px and the snapping strip below it, with `@fil` first
- no grid proximity on touch devices

## 18–19. Files and tests

Modified:

- `docs/PHASE-9D1-HOMEPAGE.md` (superseded-sections note)
- `scripts/test-phase9d-browser.mjs`
- `src/app/globals.css`
- `src/components/home/home-view.tsx`
- `src/components/home/profile-cards.tsx`
- `src/components/ui/app-navbar.tsx` (adds the `grid-rule` class)
- `src/components/ui/structure.tsx` (`GridPulse`, `RuleSection rulePulse`)
- `src/lib/example-developers.ts` (Early Bird removed)
- `tests/activity-fingerprint.test.ts`
- `tests/homepage.test.tsx`

Added:

- `docs/PHASE-9D2-HOMEPAGE.md`
- `src/components/home/card-stack.tsx`
- `src/components/home/extension-cta.tsx`
- `src/components/ui/grid-signal.tsx`
- `src/lib/card-stack.ts`
- `src/lib/distribution.ts`
- `tests/phase9d2-homepage.test.tsx`

**Unit tests:** 708 → 721.

- New `phase9d2-homepage.test.tsx` (13):
  - band geometry, hysteresis keep/switch, no oscillation, and edge reach
  - no public URL, so no link; only official HTTPS listings accepted
  - the active-link state, and entry paths in the hero and final CTA for
    both auth states
  - four-card composition, order, positions and variables
  - no randomness
  - deterministic `aria-hidden` pulses, and pulse animation only without
    reduced motion
  - proximity strips hidden by default
  - both controllers free of React state and coalesced to animation frames
- `homepage.test.tsx`: four cards, three focusable examples, the entry-path
  markup.
- `activity-fingerprint.test.ts`: three examples with distinct peaks.

**Browser harness:**

- Hero: 4 cards; `@fil` 8–12% larger; primary and extension entry paths
  (coming-soon, no link, ≥44px).
- Cards:
  - every band ≥100px and visible at its centre
  - each card activates with a coordinated before/after spread and full
    visibility
  - the headline stays clear in every state
  - jitter and sweep are stable, and there are no frames while still
  - leaving resets the fan; focus previews like hover
  - Enter/Escape lock and release; a lock survives exploring; an outside
    click releases it
- Grid:
  - the rail and rule respond locally while distant rails and rules stay
    neutral
  - no frames while still, a neutral reset on leave, and the ambient pulse
    runs
  - reduced motion disables pulses and proximity
  - touch has no grid signal
- Responsive: every listed width, plus the 9D.1 fingerprint and owner
  regressions.

## 20. Validation

| Check | Result |
| --- | --- |
| `npm test` | 21 files, 721 tests passed |
| `npm run lint` | Passed |
| `npx --no-install tsc --noEmit` | Passed |
| `npm run build` | Passed |
| Phase 9D/9D.1/9D.2 browser harness | All sections passed |
| Phase 9C profile browser harness | Passed |
| `git diff --check` | Passed |
| DB tests / production verifier | Not run: no DB, API or privacy change |

## 21. Screenshots (local, not committed)

`/private/tmp/stack-stats-phase9d2/`:

- **Homepage:** `home-1360.png`, `home-1180.png`, `home-1024.png`,
  `home-820.png`, `home-390.png`, `home-320.png`
- **Hero:** `hero-rest.png`, `hero-card-first-active.png`,
  `hero-card-middle-active.png`, `hero-card-live-active.png`,
  `extension-cta.png`
- **Grid:** `grid-idle.png`, `grid-near-rail.png`, `grid-near-rule.png`,
  `grid-reduced-motion.png`, `reduced-motion.png`
- **Fingerprint and owner:** `waterfall-idle.png`, `waterfall-active.png`,
  `waterfall-reduced-motion.png`, `home-authenticated-owner.png`
- `comparison/` (4 vs 5 cards), `before/` (Phase 9D.1), `profile/` (Phase 9C
  harness)

The front `@fil` card uses the synthetic stand-in fixture (published values
passed through the production adapter).

## 22. Remaining issues

- The rail proximity response is deliberately faint; on some displays it may
  go unnoticed. The rule and guide responses read more clearly.
- The container-query-unit pulses require Chrome 105+, Safari 16+ or Firefox
  110+. Older browsers simply show no pulse.
- A locked example card persists until release. There is no timeout, by
  design.
- The monochrome VS Code mark identifies the editor. Before publication,
  confirm usage against Microsoft's current VS Code brand guidelines.
- Tested in headless Chrome with emulation only. Safari, Firefox and physical
  devices remain manual follow-up.

## Staging

```sh
cd /Users/fstopyra/Desktop/stack-stats/stack-stats-web
git diff --check
git add -- \
  docs/PHASE-9D1-HOMEPAGE.md \
  docs/PHASE-9D2-HOMEPAGE.md \
  scripts/test-phase9d-browser.mjs \
  src/app/globals.css \
  src/components/home/card-stack.tsx \
  src/components/home/extension-cta.tsx \
  src/components/home/home-view.tsx \
  src/components/home/profile-cards.tsx \
  src/components/ui/app-navbar.tsx \
  src/components/ui/grid-signal.tsx \
  src/components/ui/structure.tsx \
  src/lib/card-stack.ts \
  src/lib/distribution.ts \
  src/lib/example-developers.ts \
  tests/activity-fingerprint.test.ts \
  tests/homepage.test.tsx \
  tests/phase9d2-homepage.test.tsx
git diff --cached --check
git diff --cached --stat
```

## Commit

```sh
git commit -m "Refine homepage card fan, add grid signal and VS Code entry path"
```
