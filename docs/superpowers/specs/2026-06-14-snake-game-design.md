# Snake game — design spec

**Date:** 2026-06-14
**Status:** Approved for planning

A personal, ad-free, offline replica of the snake.io experience, built for the family's
iPads (and Android tablets later) so the kids get the real-game feel without ads, in-app
purchases, or exposure to strangers online.

## Goals

- Recreate the snake.io *feel* closely enough that the kids see it as "the real game,"
  not a copy.
- Run fully offline on iPad first, with a single codebase that also runs on Android tablets.
- No ads, no in-app purchases, no online/multiplayer, no contact with other real people.
- Fun and fair across a wide age range (5-6 and 9-10) via selectable difficulty.

## Non-goals

- No online or networked play of any kind (deliberate child-safety decision).
- No accounts, no telemetry, no analytics.
- No native iOS/Android app or app-store distribution in v1 (revisit later if wanted).
- No real-money or simulated-money economy.

## Platform & technology

- **Web game**: TypeScript compiled by **Vite** to a static bundle, rendering to an HTML5
  `<canvas>`. No runtime dependencies; TypeScript and Vite are build-time only.
- Shipped as a **PWA** (web app manifest + service worker) so it installs to the home
  screen with its own icon, runs full-screen with no browser chrome, and works offline
  (airplane mode) once cached.
- One codebase serves iPad (Safari) and Android tablets (Chrome) identically.
- Target orientation: **landscape**.

Rationale: a 2D snake game is an ideal fit for plain Canvas — small, fast, dependency-free,
trivially cross-platform, observable in a browser during development, and free to
distribute. TypeScript adds compile-time safety for the vector/entity/state-heavy code
without adding runtime weight.

## Architecture

Focused modules, each with one clear purpose and a narrow interface:

- `engine` — fixed-timestep game loop and simulation update; decoupled from rendering.
- `arena` — the bounded world (coordinates, deadly border) and the camera that follows
  the player.
- `snake` — snake body model for player and bots: mass, length, segment positions, and
  girth (segment radius derived from mass).
- `bots` — AI steering decisions (wander, seek food, avoid collisions, optionally cut off
  the player); difficulty-parameterized.
- `food` — food spawning, the scattered field, and the food-burst left by dead snakes.
- `input` — virtual thumbstick + boost button; maps touch to a steering vector and boost
  state.
- `render` — all canvas drawing (world, snakes, food, effects), driven by the camera.
- `skins` — the skin roster and procedural per-segment drawing that scales with girth.
- `ui` — screen flow and HUD (start, play, game over; leaderboard, score, crown).
- `persistence` — `localStorage` for best score, last-used skin, and difficulty.

The simulation is a single authoritative model; rendering is a pure projection of it
through the camera (the same separation snake.io uses). Simulation logic is kept pure and
free of canvas/DOM access so it can be unit-tested directly.

## Core mechanics

- **World**: a large bounded **circular arena**, larger than the viewport. The border is
  **always deadly** — a snake dies the instant its head crosses it, on every difficulty.
  The camera follows the player's head.
- **Food & growth**: food is scattered across the world. Eating it increases the snake's
  **mass**. Mass drives **both length and segment radius**, so the snake grows longer *and*
  fatter — a defining snake.io visual. A maxed snake should feel huge and dominant.
- **Boost**: holding the boost button gives a speed burst that steadily **sheds mass**
  (dropping food behind the snake). Risk/reward: catch a rival or escape, at the cost of
  size. **Bots boost too** — to reach food first or to cut the player off — so the speed
  mechanic is symmetric for player and bots. How often and how cleverly bots boost scales
  with their aggression/cunning (see difficulty).
- **Collisions & death**:
  - A snake dies if its **head** strikes **another snake's body** or the deadly border.
  - Head-to-body is one-directional: steer so rivals crash into *your* body to kill them.
  - A dead snake **bursts into a line of glowing food** along its former body, which any
    snake can rush to eat — the big growth moments.
- **Scoring**: score = snake length/mass (no hard win condition; it's score-chasing like
  the real game). **Best score is saved locally** and shown on the HUD and game-over screen.
- **King of the board**: whoever holds **rank #1** on the leaderboard is "the King" and
  wears a **crown** on their snake's head and beside their leaderboard name — player or bot.
  When the player becomes King, a brief "You're the King! 👑" flash and a subtle glow play.
  When a bot overtakes the player, the crown visibly moves to that bot.

## Controls

- **Virtual thumbstick**, bottom-left: large touch target with a generous dead-zone so
  small hands can steer reliably; output is a steering direction the snake turns toward
  (bounded turn rate).
- **Boost button**, bottom-right: hold to boost.
- Designed for landscape tablet play; touch is the **primary** control. For local testing
  on a desktop/laptop, a **mouse mode** toggle makes the snake steer toward the mouse
  pointer and boost on mouse-click. The toggle lives on the start screen and is remembered
  between sessions; it does not affect touch play.

## Screens & UI

- **Start screen**: title styled to evoke the real game; **difficulty selector**
  (Easy / Normal / Hard); a **swipeable skin carousel** with all skins unlocked; Play button.
- **Play screen (HUD)**: length + best score top-center; **leaderboard** top-right (the
  player and named bots, crown on rank #1); thumbstick bottom-left; boost bottom-right.
- **Game-over screen**: final score, best score, **Play Again**, and **Change Snake**.

## Bots & difficulty

**Difficulty changes only the bot AI — never the rules of the game.** All snakes (player
and bots) share the same base speed and the same boost mechanic; border death, collisions,
and growth are identical on every difficulty. What changes is how many bots there are and
how clever and aggressive they play — including when they choose to boost to chase food or
trap the player:

- **Easy** — few bots that mostly wander and graze, and rarely hunt the player; suited to
  the 5-6 year old.
- **Normal** — more bots that seek food, avoid collisions, and sometimes cut the player off.
- **Hard** — many bots that actively hunt, anticipate the player's path, and try to trap
  them; suited to the 9-10 year old and up.

Difficulty is chosen on the start screen and remembered between sessions.

## Skins

A roster of visually distinct characters spanning the range kids love — cute critters,
dogs, dragons, and patterned snakes. Each skin is defined by colors/pattern (and an optional
face) and drawn **procedurally per segment** so it scales correctly as girth grows. All
skins are unlocked from the start; the chosen skin is remembered.

The overall art *vibe* is "Cute & Candy" (bright, friendly board and UI), while individual
skins range from adorable to cool so every kid finds a favorite.

## Audio

Original, royalty-free **sound effects and background music designed to evoke snake.io's
feel** — the real game's audio is copyrighted and is not reused. Effects cover the key
moments: eating food, boosting, dying, and becoming King; a light, upbeat music track loops
during play. Audio plays via the Web Audio API (started on first user interaction, per
mobile autoplay rules) and there is a **mute toggle** (state remembered between sessions).

## Persistence

`localStorage` only: best score, last-used skin, selected difficulty, mute preference. No
accounts, no network, no analytics.

## Testing

- **Unit tests (Vitest)** for the pure simulation logic, which must be correct:
  - mass → length and mass → girth growth math,
  - collision detection (head-to-body, head-to-border),
  - boost mass-shedding,
  - bot steering decisions,
  - leaderboard ranking and King assignment.
- **Manual/observed validation** in a browser for feel, controls, and rendering, including
  an end-to-end success path (start → eat/grow → become King) and failure paths (collide
  with a body, hit the border).

## Distribution / installing on the iPad

Ship the static Vite `dist/` output. Install by opening the game's URL once in Safari on the
iPad → **Add to Home Screen** → full-screen offline app icon thereafter. Hosting options to
be chosen at deploy time (e.g. serving from the Mac over home wifi, or any free static host);
no backend is required.

## Open questions / future ideas (out of scope for v1)

- Optional score-milestone skin unlocks for added replay motivation.
- Additional game modes.yeah f
