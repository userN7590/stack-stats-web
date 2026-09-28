# Stack Stats — Website Visual Direction Handover

## Context

We have been exploring a new visual direction for the **Stack Stats web experience**, particularly the landing/homepage and eventually public developer profiles.

This discussion was **not about immediately implementing a redesign**. It was about establishing a stronger visual identity for Stack Stats before deciding exactly how the existing site should change.

The current site already has a restrained dark/editorial aesthetic. The goal is **not to throw that away** and replace it with a generic trendy SaaS landing page.

Instead, the direction that emerged combines three specific design ideas:

1. **Professional typography with playful hand-drawn/illustrative annotations** 
2. **A visible structural grid running through the website** 
3. **Interactive, data-driven generative graphics — particularly a ridgeline/waterfall visualization** 

These should work together as one coherent design language rather than as three unrelated visual gimmicks.

The central conceptual theme is:

> **Precision vs. personality.**
>
> Stack Stats takes the messy, human process of writing software and turns it into structured, measurable data.

Another useful design principle that emerged:

> **Data is the decoration.**

Rather than filling the website with generic gradients, floating 3D objects, glass cards, glowing blobs, or random particle effects, Stack Stats should use **developer activity itself as visual material** wherever possible.

---

# 1. Current Stack Stats Design

The current authenticated homepage shown during the discussion has:

-  very dark / near-black background 
-  off-white text 
-  serif hero typography 
-  monospace branding and supporting UI 
-  blue accent 
-  restrained borders 
-  large amounts of whitespace 
-  relatively simple navigation 
-  example developer profile 
-  basic quantitative stats 
-  language activity visualization 
-  minimal footer 

Current hero:

> **Your development. One profile.**

Supporting copy:

> Create a public profile for the work behind your code.

The current design is already fairly tasteful and minimal.

Therefore, **do not interpret this handover as "replace everything."**

The desired redesign should feel like an evolution of the current Stack Stats identity.

We specifically do **not** want the typical developer SaaS treatment:

-  giant purple/blue gradient 
-  glowing blobs 
-  excessive glassmorphism 
-  generic floating dashboard screenshots 
-  excessive rounded cards 
-  random 3D shapes 
-  "AI startup" visual clichés 

Stack Stats should feel more **editorial, technical, experimental, and intentional.**

---

# 2. Design Pillar One — Typography + Playful Visual Annotations

The first reference explored was a typography style where otherwise clean typography is interrupted by playful visual objects.

The exact reference was somewhat more playful than what Stack Stats should become, but the underlying concept was useful.

The desired treatment is:

> **Professional typography with selective hand-drawn or technical visual annotations around important words.**

This can also be described as:

-  editorial typography with hand-drawn annotations 
-  typography with illustrative accents 
-  doodle typography 
-  Swiss/editorial typography with hand-drawn elements 
-  mixed-media typography 

However, Stack Stats should use the technique **much more conservatively** than a playful consumer brand.

## Important distinction

We do **not** simply want:

> DEVELOPMENT [icon]

or:

> QUANTIFIED [icon]

The illustration does not always need to sit after a word.

It can:

-  appear behind the word 
-  overlap part of it 
-  sit above it 
-  underline it 
-  circle it 
-  intersect the baseline 
-  point toward it 
-  extend out from one of its letters 
-  appear between words 
-  sit partially outside the normal content grid 

The effect should feel like someone made a beautiful, carefully typeset page and then **annotated certain ideas by hand.**

---

# 3. What Those Annotations Should Look Like

For Stack Stats, annotations should primarily reference programming, measurement, activity, and data.

Possible visual vocabulary:

- `{ }` 
- `</>` 
-  terminal caret 
-  cursor 
-  mouse pointer 
-  keyboard key 
-  tiny terminal 
-  Git branch 
-  node diagram 
-  line chart 
-  bar chart 
-  tiny scatter plot 
-  measurement ticks 
-  ruler marks 
-  stopwatch 
-  clock 
-  scribbled circle 
-  hand-drawn underline 
-  arrow 
-  looping arrow 
-  brackets 
-  binary digits 
-  tiny code fragment 
-  commit/node symbol 
-  miniature activity graph 
-  coordinate marks 
-  crosshair 
-  little stars/sparks where appropriate 

These should **not all be used simultaneously.**

They create a vocabulary from which the site can selectively draw.

---

# 4. Applying This to the Current Hero

Current:

> **Your development. One profile.**

Both **development** and **profile** are natural semantic anchors.

For example:

### Development

Could receive:

-  rough `{ }` 
-  tiny code-path diagram 
-  terminal caret 
-  hand-drawn `</>` 
-  scribbled development/activity line 
-  cursor 

### Profile

Could receive:

-  tiny network of nodes 
-  ID-card-like outline 
-  circular hand-drawn mark 
-  small user/data diagram 
-  several data points converging into one object 

Again, these shouldn't simply be emoji-like icons placed beside the words.

They should participate in the typography/composition.

Example conceptually:

> Your **development**.
>
> *small `{ }` sketch partially behind/above development*
>
> One **profile**.
>
> *small node structure intersecting/circling profile*

The typography remains the hero.

The illustration **supports the word rather than replacing it.**

---

# 5. Annotation Density

This is extremely important.

**Do not annotate everything.**

If every heading has:

-  an arrow 
-  a scribble 
-  an icon 
-  a circle 
-  an underline 

then the visual language immediately becomes noisy and childish.

The desired ratio is roughly:

> **90% structured/professional**
>
> **10% playful/human**

Annotations should therefore appear primarily around:

-  hero messaging 
-  major section headings 
-  especially important metrics/concepts 
-  occasional CTA or explanatory moments 

They should feel surprising when encountered.

---

# 6. Design Pillar Two — Visible Structural Grid

The second major reference was the Firecrawl website.

The specific feature of interest was **not Firecrawl's overall branding**.

It was the way the page's layout grid is visibly exposed.

The main content area is bounded by subtle vertical rules, and horizontal rules divide sections. These intersect and continue through the page.

Instead of hiding the CSS/layout structure, the design intentionally exposes it.

Think:

> **architectural grid**

rather than:

> **everything inside cards**

---

# 7. Structural Grid Behavior

Stack Stats should potentially have persistent vertical rails defining its central content width.

For example:

```
```

```
      │                                           │
      │              HERO                         │
      │                                           │
──────┼───────────────────────────────────────────┼──────
      │                                           │
      │              PROFILE                      │
      │                                           │
──────┼──────────────┬──────────────┬─────────────┼──────
      │              │              │             │
      │    STAT      │    STAT      │    STAT     │
      │              │              │             │
──────┼──────────────┴──────────────┴─────────────┼──────
```

The grid should influence:

-  hero width 
-  section boundaries 
-  stats 
-  charts 
-  cards 
-  profile sections 
-  footer 
-  navigation 
-  empty space 

Some lines may continue through areas where there is no content.

That is desirable.

It gives the entire page an underlying **technical coordinate-system feeling.**

---

# 8. Do Not Box Everything

One important observation from the Firecrawl reference:

The exposed grid works because **not every piece of content becomes a card.**

Stack Stats should avoid becoming:

```
```

```
[ CARD ][ CARD ][ CARD ]
[ CARD ][ CARD ][ CARD ]
[ CARD ][ CARD ][ CARD ]
```

Instead, borders should establish:

-  rhythm 
-  alignment 
-  hierarchy 
-  boundaries 
-  geometry 

Sometimes a vertical line should simply continue through 500px of whitespace.

Sometimes a horizontal rule should span the entire viewport.

Sometimes content should occupy only one part of a grid cell.

That empty structure is part of the visual identity.

---

# 9. Grid Visual Treatment

The grid should be **quiet**.

Especially on the current dark Stack Stats palette, it could use extremely subtle low-contrast lines.

It should almost disappear when you're focused on the content.

It should become noticeable when you look at the composition as a whole.

The hierarchy should eventually be:

**Content → interactive data visualization → annotations → grid**

The grid should never overpower the page.

---

# 10. Design Pillar Three — Interactive Generative Data Graphics

The third reference was the Solcoa website.

That site uses an abstract object composed from tiny dots/halftone-like points that deforms and changes during interaction.

Relevant terminology includes:

-  generative graphics 
-  procedural graphics 
-  particle systems 
-  point clouds 
-  stippling 
-  halftone rendering 
-  WebGL 
-  shaders 
-  interactive meshes 
-  flow fields 

The initial thought was that Stack Stats could use something similar.

However, the discussion evolved into something **much more specific to Stack Stats.**

Rather than adding an arbitrary particle blob:

> **Turn Stack Stats' charts/data into the generative artwork.**

---

# 11. "Data Is the Decoration"

This became one of the strongest ideas from the discussion.

Most modern technology websites add decorative elements unrelated to the actual product:

-  floating spheres 
-  blobs 
-  abstract gradients 
-  chrome objects 
-  particles 
-  generic waves 

Stack Stats already contains visually interesting information:

-  coding sessions 
-  activity over time 
-  languages 
-  projects 
-  commits/code changes 
-  streaks 
-  coding time 
-  activity by hour 
-  AI vs. human activity eventually 
-  etc. 

Therefore:

> **The visual artwork should emerge from developer data itself.**

The product shouldn't need generic decoration.

Its data **is** its decoration.

---

# 12. Primary Interactive Graphic — Waterfall / Ridgeline Plot

The specific chart reference shown was a **3D waterfall/ridgeline plot**.

It contains many adjacent waves/ridges representing a sequence of distributions.

Visually, imagine:

```
```

```
          /\____
       __/  \____
     _/      \____
   _/         \____
 _/            \____
```

repeated into depth.

This should potentially become a signature Stack Stats visual.

---

# 13. Hero Waterfall Visualization

Instead of placing a normal chart inside a rectangular analytics card, the waterfall visualization could become a **large graphical object integrated directly into the hero composition.**

Potential structure:

```
```

```
│                                                      │
│        Your development.                             │
│                { }                                   │
│        One profile.                                  │
│                              ↗                       │
│                                                      │
│                    ╱╲                                │
│                ╱╲ ╱  ╲___                            │
│            ╱╲ ╱  ╲      ╲___                         │
│        ╱╲ ╱  ╲             ╲___                      │
│    ╱╲ ╱  ╲                    ╲___                   │
│                                                      │
├──────────────────────────────────────────────────────┤
```

The visualization could exist:

-  beneath the headline 
-  behind parts of the headline 
-  offset beside the headline 
-  extending across multiple grid columns 
-  partially clipped by structural boundaries 

Exact composition remains open.

---

# 14. Interactive Behavior of the Waterfall

The waterfall should respond to interaction.

Possible behavior discussed:

### Cursor proximity

As the cursor approaches an individual ridge:

-  that ridge rises 
-  it bends toward/away from the pointer 
-  amplitude increases 
-  nearby ridges react at lower intensity 

This could create something like a physical field.

### Horizontal movement

Moving the cursor across the visualization could produce a wave that travels through consecutive ridges.

### Vertical movement

Could change:

-  amplitude 
-  depth 
-  perspective 
-  deformation intensity 

### Dragging

Potentially allow slight rotation of the visualization.

This should be subtle rather than behaving like a full 3D model viewer.

### Scroll

Scrolling through the page could gradually:

-  rotate the chart 
-  compress depth 
-  spread ridges apart 
-  transition from abstract → analytical 
-  change perspective 
-  reorganize the graphic 

A particularly interesting possibility:

> Start as an expressive 3D visual object and gradually resolve into a readable data visualization.

That directly communicates the idea of turning development activity into understandable data.

---

# 15. Real Data Eventually

The strongest long-term implementation would use **actual Stack Stats data**.

For example:

### Each ridge = one day

X-axis:

> hour of day

Y/amplitude:

> coding activity

Depth:

> consecutive days

This would produce a unique visual fingerprint for each developer.

Someone who codes heavily at night would create a different shape from someone who codes 9–5.

Someone who codes in long sessions would look different from someone who works in short bursts.

Someone with highly consistent activity would produce a different pattern from someone with irregular bursts.

This means the visual could become:

> **A developer's activity fingerprint.**

That is much more meaningful than a generic hero animation.

---

# 16. Anonymous vs. Authenticated Experience

For visitors without data:

Use a carefully designed representative/example dataset.

It should clearly function as visual storytelling rather than pretending to be the visitor's activity.

For authenticated users:

Eventually generate the visualization using their own activity.

This could create a nice moment where Stack Stats literally becomes visually personalized.

Potentially:

> Every developer gets their own unique Stack Stats "shape."

This could later extend to:

-  profile headers 
-  share cards 
-  social previews 
-  annual recaps 
-  weekly summaries 
-  developer comparisons 
-  profile backgrounds 

That is **future exploration**, not an immediate requirement.

---

# 17. Visual Treatment of the Waterfall

Do **not** reproduce the colorful scientific Plotly appearance of the reference screenshot.

The underlying geometry is what was interesting.

Stack Stats' version should probably be much more restrained.

Potentially:

-  off-white lines on near-black 
-  subtle grey depth 
-  one blue/accent ridge 
-  thin strokes 
-  dots rather than filled surfaces 
-  hybrid line + stipple rendering 
-  occasional highlighted points 

It should initially read as:

> beautiful technical object

and only secondarily as:

> oh, this is actually developer activity data.

---

# 18. Combining All Three Systems

The three visual systems should each have a distinct role.

## Grid

Represents:

-  structure 
-  measurement 
-  system 
-  precision 
-  engineering 

Should be **quietest**.

---

## Hand-drawn annotations

Represent:

-  developer 
-  human 
-  personality 
-  creativity 
-  imperfection 
-  thought process 

Should be **occasional**.

---

## Interactive data visualization

Represents:

-  activity 
-  measurement 
-  Stack Stats itself 
-  transformation of behavior into information 

Should be the **visual centerpiece**.

---

# 19. Conceptual Identity

The strongest conceptual framing that emerged was:

> **Rigid system underneath. Human messiness on top. Data in motion.**

Another:

> **Precision vs. personality.**

And another:

> **Data is the decoration.**

These are not necessarily marketing slogans.

They're useful **internal design principles**.

Stack Stats sits between two worlds:

```
```

```
HUMAN                    MACHINE

creativity               measurement
messiness                 structure
coding                    statistics
experimentation           aggregation
individuality             normalization
thought                   data
```

The website can visually express that tension.

The grid is machine-like.

The data visualization is computational.

The annotations are human.

---

# 20. Potential Hero Evolution

Current:

> **Your development. One profile.**

This headline itself does not necessarily need to change.

A redesigned composition could retain it.

Conceptually:

```
```

```
──────────────────────────────────────────────────────────
│                                                        │
│               Your development.                        │
│                      { }                               │
│                                                        │
│               One profile.                             │
│                             ○──○                       │
│                                                        │
│          Create a public profile for the               │
│              work behind your code.                    │
│                                                        │
│                  [ View profile → ]                    │
│                                                        │
│                         ╱╲                             │
│                    ╱╲  ╱  ╲                            │
│                ╱╲ ╱  ╲╱    ╲___                        │
│            ╱╲ ╱  ╲           ╲___                      │
│        ╱╲ ╱  ╲                  ╲___                   │
│                                                        │
├────────────────────────────────────────────────────────┤
```

Actual implementation could be considerably more sophisticated.

---

# 21. Example Profile Section

The existing example profile should probably remain recognizable as an actual Stack Stats profile.

However, the exposed grid could make the section feel more architectural.

For example:

```
```

```
│ EXAMPLE PROFILE                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│ avatar      fil                                        │
│             @fil                                       │
│             I love building projects!                  │
│                                                        │
├──────────────┬──────────────┬──────────────┬────────────┤
│ 500          │ 200          │ 500          │ 8h 20m     │
│ lines        │ files        │ projects     │ coding     │
├──────────────┴──────────────┴──────────────┴────────────┤
│                                                        │
│ LANGUAGE ACTIVITY                                      │
│ ███████████████████████████████████▒▒▒▒▒░░░            │
│                                                        │
└────────────────────────────────────────────────────────┘
```

The borders are no longer merely card borders.

They become part of the **site-wide coordinate system.**

---

# 22. Motion Philosophy

Motion should not exist merely because animation looks impressive.

Each interaction should ideally communicate one of:

-  responsiveness 
-  activity 
-  time 
-  transformation 
-  measurement 
-  exploration 

Avoid:

-  random floating 
-  constant bouncing 
-  gratuitous parallax 
-  animation everywhere 
-  large looping animations competing with content 

The page should still look excellent when completely stationary.

Interaction should reveal another layer.

A good principle:

> **Still frame = professional editorial site.**
>
> **Interaction = computational playground.**

---

# 23. Mouse Interaction

Mouse movement can be used because this is primarily a developer-oriented product where desktop usage will be substantial.

However, functionality should **never depend on mouse hover.**

Mouse interaction should enhance the visual experience.

Possible uses:

-  ridge deformation 
-  nearest-data-point highlighting 
-  hand-drawn annotation movement 
-  slight chart perspective changes 
-  subtle grid coordinates responding to pointer 
-  crosshair/data labels 

But avoid making the entire site chase the cursor.

---

# 24. Scroll Interaction

Scroll may be even more valuable than pointer movement because it works across devices.

Possible transitions:

### Hero

Waterfall is expressive/abstract.

↓

### Product explanation

Waterfall begins flattening.

↓

### Analytics section

The same visual resolves into an understandable chart.

↓

### Profile

The data becomes actual profile statistics.

This creates visual continuity rather than every section introducing an unrelated animation.

---

# 25. Mobile Considerations

The design cannot rely entirely on mouse interactions.

On mobile:

-  waterfall can animate gently based on scroll 
-  tapping a ridge could highlight it 
-  grid remains 
-  annotations remain 
-  complex 3D perspective can simplify 
-  reduced particle count / geometry can improve performance 

The static composition must remain strong.

---

# 26. Reduced Motion / Accessibility

Any implementation should eventually respect:

`prefers-reduced-motion`

For reduced motion:

-  chart remains static 
-  interaction deformation disabled or dramatically reduced 
-  layout remains fully understandable 
-  no information disappears 

The generative visualization should be enhancement, not required functionality.

---

# 27. Performance

Because Stack Stats is a developer product, a visually impressive homepage that burns CPU/GPU or takes forever to load would undermine the brand.

If WebGL is eventually used:

-  lazy-load where appropriate 
-  minimize geometry 
-  avoid excessive particle counts 
-  pause rendering when off-screen 
-  degrade gracefully 
-  optimize mobile 
-  avoid running 60fps loops unnecessarily 

Canvas may be sufficient for some effects.

Three.js/WebGL/custom shaders should only be introduced where they materially improve the experience.

---

# 28. Potential Technical Directions — Not Decisions

No implementation stack was selected during this discussion.

Possible technologies mentioned/conceptually relevant:

-  Canvas 2D 
-  SVG 
-  CSS 
-  Three.js 
-  WebGL 
-  GLSL shaders 
-  D3 for geometry/data transformations 
-  existing charting libraries where appropriate 

The other development chat should determine implementation based on:

-  current Stack Stats architecture 
-  bundle impact 
-  accessibility 
-  mobile performance 
-  maintainability 
-  how much of the visualization uses real data 

Do **not** interpret "Three.js" as a requirement.

---

# 29. Things We Explicitly Do Not Want

Avoid drifting into:

### Generic SaaS

```
```

```
BIG HEADLINE
purple gradient
[Get Started]
floating dashboard
three rounded cards
testimonials
pricing
```

### Generic developer aesthetic

```
```

```
black background
green terminal text
code everywhere
matrix effect
```

### Generic AI aesthetic

```
```

```
purple
blue
glowing sphere
mesh gradient
glass
sparkles
```

### Excessive brutalism

The grid does not mean:

-  giant 3px borders 
-  intentionally ugly typography 
-  harsh colors 
-  everything square purely for effect 

### Excessive doodles

This should not resemble a children's notebook.

### Decorative data

Don't generate fake charts everywhere simply because charts look technical.

When possible, visualizations should eventually correspond to meaningful Stack Stats concepts.

---

# 30. Relationship to Existing Dark Theme

The current dark aesthetic still feels appropriate.

There was **no decision to switch Stack Stats to a white/light site** just because some references used white backgrounds.

Potential palette remains roughly:

-  near-black background 
-  warm/off-white foreground 
-  muted gray 
-  subtle border gray 
-  Stack Stats blue accent 
-  selective secondary data colors where needed 

The design references are being used for their **systems**, not copied literally.

Firecrawl reference:

→ take the exposed grid.

Solcoa reference:

→ take the generative interactive behavior.

Waterfall plot reference:

→ take the geometry/data visualization.

Editorial/doodle reference:

→ take selective illustrative typography.

Do **not** copy any reference website wholesale.

---

# 31. Possible Broader Design Language

If this direction works, it should eventually extend beyond the homepage.

### Public profiles

Developer's actual waterfall/activity fingerprint could become a hero element.

### Dashboard

Structural grid naturally accommodates modular statistics.

### Share cards

Could use:

-  developer name 
-  signature waterfall 
-  one large statistic 
-  Stack Stats mark 

### Weekly summaries

Generate a week's activity shape.

### Year in review

Ridgeline becomes especially compelling with long-term activity.

### Empty states

Hand-drawn annotations could provide personality.

### Loading states

Could use data-like motion rather than generic spinner.

Again, these are opportunities, not requirements.

---

# 32. One Important Product/Design Opportunity

The waterfall visualization may eventually become more than homepage decoration.

There is potential for it to become a **recognizable Stack Stats brand asset**.

GitHub has the contribution grid.

Spotify has Wrapped visualizations.

Strava has route maps.

Stack Stats could potentially have:

> **the developer activity fingerprint / waterfall.**

That would require iteration and validation, but it is worth keeping in mind while designing it.

If every developer's coding activity produces a recognizable unique graphic, Stack Stats gains something people may actually want to share.

---

# 33. Priority / Visual Hierarchy

The three systems should **not have equal visual weight.**

Recommended hierarchy:

### 1 — Content and typography

Always dominant.

### 2 — Interactive data visualization

Primary visual spectacle.

### 3 — Hand-drawn annotations

Personality and surprise.

### 4 — Structural grid

Quiet foundation.

Or simply:

> **Grid = quiet**
>
> **Annotations = occasional**
>
> **Waterfall = memorable**

This is probably the single most important restraint to maintain.

---

# 34. Design Tone

Target:

**technical**

**editorial**

**precise**

**experimental**

**human**

**developer-oriented**

**data-driven**

**slightly playful**

Not:

**corporate**

**childish**

**cyberpunk**

**crypto**

**gaming**

**generic SaaS**

**AI-generated-looking**

A useful approximation:

> **Swiss/editorial developer tooling + exposed architectural grid + restrained hand-drawn technical annotations + interactive generative data graphics.**

---

# 35. What Is Decided vs. What Is Not

## Direction we want to pursue

The website should explore all three:

**A. Hand-drawn/illustrative annotations around important words**

**B. Visible structural grid / content rails**

**C. Interactive waterfall/ridgeline data visualization**

These should form a unified system.

## Not decided yet

We have **not** finalized:

-  exact homepage layout 
-  new headline/copy 
-  exact font choices 
-  exact doodles 
-  exact waterfall dataset 
-  whether waterfall is SVG/Canvas/WebGL 
-  exact interaction physics 
-  exact grid spacing 
-  whether current serif stays 
-  exact color treatment 
-  exact scroll sequence 
-  how much real data is available to drive the hero 
-  whether waterfall becomes a permanent brand asset 
-  implementation phases 

Those should be worked through in the main Stack Stats development conversation.

---

# 36. Recommended Next Discussion in Main Stack Stats Chat

Before telling Codex or another coding agent to implement anything, the main chat should take this design direction and reconcile it against:

-  current Stack Stats homepage 
-  current public profile 
-  current metrics/data model 
-  Phase 9 / aggregation work 
-  what historical/hourly data is actually available 
-  current frontend architecture 
-  current brand identity 
-  performance budget 
-  responsive behavior 

Especially important: **the design should take advantage of the metrics Stack Stats is already beginning to collect rather than inventing visualizations first and figuring out data later.**

The waterfall's semantics should be designed alongside the metrics system.

---

# 37. Short Version

If context gets lost later, this is the essence:

> **Stack Stats should evolve into a dark editorial developer-data experience built on a subtle exposed structural grid. Important words and concepts occasionally receive imperfect hand-drawn technical annotations, creating contrast with the otherwise precise interface. The site's major visual centerpiece should be an interactive ridgeline/waterfall visualization that reacts to pointer/scroll interaction and, where possible, is generated from real developer activity. Rather than decorating the product with generic SaaS graphics, Stack Stats should treat its own data as visual material. The underlying conceptual contrast is human creativity vs. machine measurement: rigid grid underneath, human marks on top, data in motion.**
>
> **The restraint matters:** grid quiet, annotations occasional, waterfall memorable.