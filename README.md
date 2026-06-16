# 🐍 Slither Slink

A personal, ad-free, **offline** snake.io-style game for the family's tablets (iPad first,
Android later). Intended home: **slitherslink.online**. One player vs. AI bots: slither around, eat to grow longer *and* fatter,
boost, cut rivals off, and chase the "King" crown — with none of the ads, in-app purchases,
or online strangers of the real thing.

> Built for my kids. Not affiliated with snake.io.

## Status

**Playable core is working** (the full single-player game runs in a browser). Polish still
to come: persistence, on-screen HUD + menus/settings, audio, and packaging it as an
installable home-screen app (PWA). See [the plan](docs/superpowers/plans/2026-06-14-snake-game.md)
for what's done and what's left, and [the design spec](docs/superpowers/specs/2026-06-14-snake-game-design.md)
for the intended behavior.

## Running it

Requires [pnpm](https://pnpm.io) (the repo pins Node via `.npmrc`, so any shell works).

```bash
pnpm install      # first time
pnpm dev          # dev server with hot reload — open the printed http://localhost:5173
pnpm test         # unit tests (Vitest)
pnpm build        # production build into dist/ (this is the installable PWA)
pnpm preview      # serve the production build (use --host to reach it from a tablet)
```

## Building & deploying

```bash
pnpm build
```

This produces a `dist/` folder of **plain static files** — `index.html`, hashed JS/CSS, the
PWA `manifest.webmanifest`, and a generated service worker. There is **no backend**: the game
runs entirely in the browser.

To deploy, just serve `dist/` from any static host:

- **Drag-and-drop / CLI hosts** — Netlify, Vercel, Cloudflare Pages, GitHub Pages: point them at
  this repo with build command `pnpm build` and publish directory `dist`, or upload `dist/`
  directly.
- **Your own server / object storage** — copy the *contents* of `dist/` to the web root (e.g.
  `scp -r dist/* user@host:/var/www/slitherslink/`, or sync to an S3/R2 bucket behind a CDN).

It must be served over **HTTPS** (required for the service worker / installability) — `localhost`
is exempt for testing. Once it's live (e.g. at **slitherslink.online**), open it in mobile Safari/
Chrome and **Add to Home Screen** to install it as a full-screen, offline app.

> Note: the installable-PWA bits (app icon, offline caching) are still being finalised — see the
> plan's PWA task. The static deploy above already works for playing in a browser today.

## Controls

- **Touch** (primary, on tablets): drag the **left half** of the screen to steer (a thumbstick
  appears under your finger), tap/hold the **right half** (or the BOOST button) to boost. Enabled
  automatically on touch devices.
- **Mouse mode** (desktop): the snake steers toward the mouse pointer; **click to boost**.
  Toggle on the start screen (defaults to on for desktop, off for tablets).
- Keyboard fallback: arrow keys / WASD to steer, space to boost.

## How it plays

- Eat scattered food to grow; mass drives both **length and girth**.
- **Boost** (hold) for a speed burst that sheds mass into a trail you (or others) can re-collect;
  you can't boost once you shrink back to starting size.
- You die if your head's **forward cone** hits another snake's body, or if your head reaches the
  **deadly red border**. You can cross your *own* body freely.
- Kill rivals by making them run into you — a dead snake bursts into glowing pellets in its own
  colour, worth more than normal food.
- You spawn growing out from a point with a brief invulnerability pulse; bots grow out too but
  aren't invulnerable.

## Tech

Vanilla **TypeScript** + **Vite**, rendering to an HTML5 `<canvas>`. A single authoritative,
DOM-free **simulation** (unit-tested with Vitest) is drawn through a follow-camera. No runtime
dependencies, no network, no analytics. Ships as a static, offline **PWA**.

Source layout: `src/math` (vectors), `src/game` (constants, types, snake, food, collision,
bots, leaderboard, simulation), `src/config` (difficulty), `src/render` (camera, renderer),
`src/skins`, `src/input`, plus `src/main.ts` to wire it together. All tunable gameplay numbers
live in `src/game/constants.ts`.
