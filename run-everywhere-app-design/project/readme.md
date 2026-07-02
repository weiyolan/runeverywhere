# Run Everywhere — Design System

A bold, high-contrast athletic design system for **Run Everywhere**, a social running app that connects runners to **create → discover → run together → get rewarded**. Runners drop a start point to expose a running goal, find people to run with, explore cities on foot, and earn points + social reviews. In an unknown city you open the map, see what runs people have planned (color-coded by type), and request to join.

This system gives every screen one consistent foundation: type, color, spacing, reusable components, and a mobile UI kit.

## Source material
- **Figma:** "Run Everywhere" (`uploads/Run Everywhere.fig`) — 11 phone frames (auth, Your Runs, Explore map/list, half-built Create Run, two Profile variants) + a component set (run cards in 3 types × 3 styles, map pins, avatars, open/closed route markers, tab bar). The binary frame data is zstd-compressed and was not machine-readable here; this system was rebuilt from the file thumbnail + a detailed written brief, then taken in a bolder athletic direction at the user's request.
- **Direction (chosen by user):** high-contrast athletic — black/white base, **Volt** electric-lime accent, heavy condensed type; maps light-primary; a freshly re-picked run-type trio.

## Decisions locked
- **Run-type vocabulary:** `DISCOVER` · `CHALLENGE` · `SOCIAL` (resolves the Explore/Discover and Reprise/Rencontre drift). Discover = explore a city/route, Challenge = race pace/hard effort, Social = easy/meet-up/recovery.
- **Run-type colors:** Discover `#1463FF` · Challenge `#FF3D2E` · Social `#7C5CFC`.
- **IA:** one 5-tab bottom bar — Explore · Runs · **Create (+)** · Messages · Profile. The center is always a Volt Create (+), resolving the compass-vs-plus inconsistency.

---

## CONTENT FUNDAMENTALS — voice & copy
- **Tone:** confident, energetic, athletic — coach-meets-teammate. Direct and motivating, never corporate.
- **Person:** speak to the runner as **you** ("Runs near you", "You're in Lisbon"). The app refers to itself rarely.
- **Casing:** UI labels, buttons, chips, tabs, stat labels and titles are **UPPERCASE** in the condensed display face. Body copy and run goals are sentence case.
- **Buttons:** short, **verb-first**, uppercase — "REQUEST TO JOIN", "PUBLISH RUN", "START", "SAVE RUN". One primary (Volt) per screen.
- **Run goals** are the soul of the product: free-text, first-person, quoted in the UI — e.g. *"Training for an ultra, easy effort to see the old town."* Always render goals in sentence case, in quotes, in the body face.
- **Numbers matter:** distance, pace, D+, points and ratings are first-class — set in tabular condensed numerals. Format: `5.2 km`, `5:30 /km`, `+120 pts`, `4.9 ★`.
- **Emoji:** not used. Status and category are carried by color, chips, and icons — never emoji.
- **Micro-copy examples:** "4 spots left", "FULL", "You're in!", "2 requests waiting", "You're in Lisbon — runs near you".

## VISUAL FOUNDATIONS
- **Color:** near-black ink (`#0B0B0C`) + white/off-white (`#F5F5F3`) base carry ~90% of every screen. **Volt** (`#CCFF00`) is the single hero accent — primary CTAs, the Create (+), active nav, key highlights — always with near-black text/icon on it. The three run-type colors are used as **category coding only** (card accent rail, chips, map pins), never as general decoration. Functional signals: go-green (live/verified/success), amber (caution), red (destructive/report), gold (ratings).
- **Type:** the **Saira** superfamily. **Saira Condensed** (700–900, uppercase, tight tracking) for all display, titles, labels, buttons and big metrics; **Saira** (400–600) for body, goals and captions. Big numeric readouts use condensed tabular figures.
- **Spacing:** 8px base grid (with 4/12 half-steps for dense mobile UI). Screen gutter 20px.
- **Backgrounds:** flat. Off-white app background, white surfaces, near-black inverse panels (stat strips, tab bar, recaps). **No gradients** as decoration (the only soft glow is under the Volt CTA). Maps are light, with type-colored pins floating above.
- **Cards:** white, `12px` radius, hairline `#DEDEE2` border, **tight low-blur shadow** (not soft/diffuse). Run cards carry a **5px left accent rail** in the run-type color — the system's signature motif.
- **Borders:** structural and confident — 1px hairlines for dividers, **2px** bold outlines for ghost buttons and emphasis. Squared radii dominate (4–12px); capsules reserved for chips, pills and avatars.
- **Shadows:** `sm` tight contact shadow on cards, `md`/`lg` for sheets and features, a dedicated `pin` shadow so map pins read above the map, and a `volt` glow under the primary CTA.
- **Motion:** quick and punchy. 120–200ms, `ease-out` for most, a slight `spring` for the Create (+). **Press = scale 0.96** on buttons/pins. No long fades or bounces.
- **Hover/press:** buttons darken/scale on press; cards lift shadow on hover; nav active state turns the glyph Volt on ink.
- **Imagery:** runner avatars (circular, optional verified tick + status ring). Photography, when present, is energetic and warm; treat as full-bleed behind ink protection where text overlaps.
- **Radii summary:** xs 4 · sm 8 · md 12 · lg 18 · pill 999.

## ICONOGRAPHY
- **Style:** clean **outline** icons, ~2.2–2.4px stroke, round caps/joins, 24px grid — matching the athletic/condensed feel. Drawn inline as SVG with `stroke: currentColor` so they inherit run-type / nav color.
- **Recommended set:** [Lucide](https://lucide.dev) (outline, 24px, matching stroke). Use it via CDN in prototypes; key glyphs used here (route, gauge/speed, clock, compass, chat, user, plus, chevron, heart, flag, loop, check, shield) are hand-inlined in the components to stay dependency-free.
- **No emoji, no filled/duotone icon mixing.** Verified = go-green tick badge; rating = gold star (filled, the one intentional filled glyph). Closed-loop runs use a loop glyph; open routes a start/finish flag.

---

## INDEX / manifest
**Root**
- `styles.css` — global entry (link this). `@import`s all tokens.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `fonts.css`.
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `components/` — reusable primitives (see below).
- `ui_kits/mobile/` — the Run Everywhere app screen set.
- `SKILL.md` — Agent-Skill entry point.

**Components**
- `buttons/` — `Button`, `IconButton`
- `forms/` — `Input`
- `navigation/` — `Tabs`, `TabBar`
- `data/` — `TypeChip`, `Badge`, `Avatar`, `RatingStars`, `StatBlock`
- `run/` — `RunCard`, `MapPin`, `RouteMarker`

**UI kit (mobile)** — Explore (map + run sheet), Your Runs (ALL / MANAGED / JOINED), **Run Detail** (the highest-impact missing screen: goal, host, route, who's joined, Request to join), Profile (stats, rating, reviews). Interactive click-through in `ui_kits/mobile/index.html`.

## Caveats
- Webfonts are loaded from the Google Fonts CDN. For offline/production, swap `tokens/fonts.css` for local `.woff2` files.
- The original `.fig` vector data couldn't be decompressed in this environment (zstd), so exact pixel values from the Figma weren't lifted — the system is a faithful, bolder reinterpretation of the brief. If you re-share the frames as PNGs or a live Figma link, I can tune specifics.
