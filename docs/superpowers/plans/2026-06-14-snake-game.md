# Snake Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline, ad-free, snake.io-style web game for tablets (iPad first, Android later) where one child plays against AI bots, growing longer and fatter, killing rivals, and competing for the "King" crown.

**Architecture:** Vanilla TypeScript compiled by Vite to a static, installable PWA. A single authoritative simulation (pure, DOM-free, unit-tested) is rendered through a follow-camera onto an HTML5 canvas. Touch input (thumbstick + boost) drives the player snake; bots are AI-steered. No runtime dependencies; no network.

**Tech Stack:** TypeScript, Vite, Vitest (+ jsdom for storage tests), HTML5 Canvas, Web Audio API (original snake.io-style SFX + music), `vite-plugin-pwa` (build-time only) for offline caching, `localStorage` for persistence.

---

## File Structure

```
snake/
  package.json                 # scripts + dev deps
  tsconfig.json                # strict TS config
  vite.config.ts               # Vite + PWA plugin + Vitest config
  index.html                   # canvas + HUD/screen mount points
  src/
    style.css                  # layout + screen/HUD styling
    main.ts                    # app entry: wires screens, loop, simulation, render
    math/
      vec2.ts                  # pure 2D vector + angle helpers
      vec2.test.ts
    game/
      constants.ts             # all tunable numeric constants
      types.ts                 # shared data types (Snake, Food, GameState, ...)
      snake.ts                 # snake body model: growth, girth, movement
      snake.test.ts
      food.ts                  # food field: spawn, eat, death-burst
      food.test.ts
      collision.ts             # head-to-body and head-to-border detection
      collision.test.ts
      bots.ts                  # AI steering decisions
      bots.test.ts
      leaderboard.ts           # ranking + King selection
      leaderboard.test.ts
      simulation.ts            # one-tick orchestration; createGame()
      simulation.test.ts
    config/
      difficulty.ts            # Easy/Normal/Hard presets
      difficulty.test.ts
    input/
      controls.ts              # thumbstick + boost -> InputState
    render/
      camera.ts                # world<->screen transform following player
      camera.test.ts
      renderer.ts              # draws world, food, snakes, effects
    skins/
      skins.ts                 # skin roster + procedural snake drawing
    ui/
      screens.ts              # start + game-over DOM overlays
      hud.ts                   # leaderboard, minimap, score, King flash, mute toggle
    audio/
      audio.ts                 # Web Audio sound effects + looping music + mute
    persistence/
      storage.ts               # localStorage best score / skin / difficulty
      storage.test.ts
  public/
    manifest.webmanifest       # PWA manifest
    icons/                     # generated app icons (192/512/apple-touch)
  tools/
    make-icons.html            # one-time icon generator (run in browser)
```

**Responsibility split:** pure simulation logic (`math/`, `game/`, `config/`, `persistence/`) is DOM-free and unit-tested. Presentation (`render/`, `ui/`, `input/`, `skins/`, `main.ts`) touches the canvas/DOM and is validated by running the game in a browser.

---

## Vertical-slice execution order (testable checkpoints)

The build order is reorganized so the game is runnable in a desktop browser **early and
often**, not only at the very end. Every module is still built test-first; on top of that
there are three **integration checkpoints** where you run `pnpm dev`, turn on mouse mode,
and actually play.

Order (task numbers refer to the task sections below):

1. Task 0 — scaffold ✅
2. Task 1 — vec2
3. Task 2 — constants & types
4. Task 4 — snake model
5. Task 10 — camera
6. Task 7 — leaderboard (needed by the renderer)
7. Task 12 — skins (`drawSnake`, needed by the renderer)
8. Task 13 — renderer
9. Task 14 — controls
10. **Checkpoint A — “drive a snake”** (below): minimal `main.ts`; `pnpm dev`, steer a snake with the mouse, camera follows, border visible.
11. Task 5 — food
12. Task 3 — difficulty
13. Task 8 — bots (steer + boost)
14. Task 6 — collision
15. Task 9 — simulation
16. **Checkpoint B — “playable core”** (below): mid `main.ts`; the full single-player game — bots, eat/grow, boost, death → instant restart. No HUD/audio yet.
17. Task 11 — persistence
18. Task 15 — HUD & screens
19. Task 16 — audio
20. **Checkpoint C — Task 17 (wire)**: final `main.ts` (start screen, HUD, King flash, audio, mute, persistence). This REPLACES the checkpoint mains.
21. Task 18 — PWA
22. Task 19 — install & verify

The checkpoint mains are deliberate throwaway scaffolding that the next checkpoint
overwrites — keep them tiny. Each checkpoint task: write the file, run
`pnpm exec tsc --noEmit`, run `pnpm dev` and verify by playing, then commit.

### Checkpoint A — minimal `src/main.ts` (drive one snake)

Depends on: vec2, constants, types, snake, camera, leaderboard, skins, renderer, controls.

```ts
import './style.css';
import { rotateToward } from './math/vec2';
import { createSnake, stepSnake, applyGrowth } from './game/snake';
import { makeCamera } from './render/camera';
import { render } from './render/renderer';
import { Controls } from './input/controls';
import { TURN_RATE, BASE_SPEED, WORLD_RADIUS } from './game/constants';
import type { GameState } from './game/types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const controls = new Controls(canvas);
controls.setMouseMode(true); // desktop testing: drive with the mouse

const state: GameState = {
  world: { radius: WORLD_RADIUS },
  snakes: [createSnake({ id: 'player', name: 'You', isPlayer: true, skinId: 'pink', pos: { x: 0, y: 0 }, heading: 0 })],
  food: [],
  nextFoodId: 1,
  tick: 0,
};
const player = state.snakes[0];

const FIXED_DT = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now: number) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  const input = controls.read();
  while (acc >= FIXED_DT) {
    if (input.steerAngle !== null) {
      player.heading = rotateToward(player.heading, input.steerAngle, TURN_RATE * FIXED_DT);
    }
    stepSnake(player, BASE_SPEED, FIXED_DT);
    applyGrowth(player);
    acc -= FIXED_DT;
  }
  const cam = makeCamera(player.segments[0], window.innerWidth, window.innerHeight, 1);
  render(ctx, state, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Verify: `pnpm dev`, move the mouse — the snake steers toward the pointer, the camera follows, and the arena border ring is visible. Commit: `feat: checkpoint A — drivable snake on canvas`.

### Checkpoint B — mid `src/main.ts` (playable core, no UI chrome)

Depends on additionally: food, difficulty, bots, collision, simulation.

```ts
import './style.css';
import { createGame, update, PLAYER_ID } from './game/simulation';
import { DIFFICULTIES } from './config/difficulty';
import { Controls } from './input/controls';
import { makeCamera } from './render/camera';
import { render } from './render/renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const controls = new Controls(canvas);
controls.setMouseMode(true); // desktop testing
const rng = () => Math.random();
const settings = DIFFICULTIES.normal;

let state = createGame('normal', 'pink', rng);
let player = state.snakes.find((s) => s.id === PLAYER_ID)!;

const FIXED_DT = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now: number) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  const input = controls.read();
  while (acc >= FIXED_DT) {
    update(state, FIXED_DT, input, settings, rng);
    acc -= FIXED_DT;
  }
  if (!player.alive) {
    // instant restart for testing (final main shows a game-over screen instead)
    state = createGame('normal', 'pink', rng);
    player = state.snakes.find((s) => s.id === PLAYER_ID)!;
  }
  const cam = makeCamera(player.segments[0], window.innerWidth, window.innerHeight, 1);
  render(ctx, state, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Verify: `pnpm dev`, play — bots roam and boost, eating pellets grows you longer and fatter, clicking boosts, hitting a body or the border kills you and instantly restarts. Commit: `feat: checkpoint B — playable single-player core`.

---

## Task 0: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/style.css`, `src/main.ts`, `.gitignore` (append)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "snake-game",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "jsdom": "^24.1.0",
    "typescript": "^5.4.5",
    "vite": "^5.3.0",
    "vite-plugin-pwa": "^0.20.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`** (Vite build + PWA + Vitest in one file)

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: false, // we ship our own public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/storage.test.ts', 'jsdom']],
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#ffe3a3" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
    <title>Snake!</title>
  </head>
  <body>
    <canvas id="game"></canvas>
    <div id="hud"></div>
    <div id="screens"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/style.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1530; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  touch-action: none; overscroll-behavior: none;
}
#game { display: block; width: 100vw; height: 100vh; }
#hud, #screens { position: fixed; inset: 0; pointer-events: none; }
#hud > *, #screens > * { pointer-events: auto; }
.hidden { display: none !important; }
```

- [ ] **Step 6: Create placeholder `src/main.ts`**

```ts
import './style.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.fillStyle = '#ffe3a3';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#333';
ctx.font = '32px system-ui';
ctx.fillText('Snake scaffold OK', 40, 60);
```

- [ ] **Step 7: Append build artifacts to `.gitignore`**

```
node_modules/
dist/
dev-dist/
```

- [ ] **Step 8: Install dependencies**

Run: `pnpm install`
Expected: completes, creates `node_modules/` and `pnpm-lock.yaml`.

- [ ] **Step 9: Verify dev server boots**

Run: `pnpm dev` (then stop it with Ctrl-C after confirming)
Expected: Vite prints a `localhost` URL; opening it shows "Snake scaffold OK" on a sand-colored canvas.

- [ ] **Step 10: Verify test runner works**

Run: `pnpm test`
Expected: Vitest runs and reports "no test files found" (exit 0). This confirms the toolchain.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Vitest PWA project"
```

---

## Task 1: 2D vector & angle math

**Files:**
- Create: `src/math/vec2.ts`
- Test: `src/math/vec2.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/math/vec2.test.ts
import { describe, it, expect } from 'vitest';
import {
  vec, add, sub, scale, length, normalize, distance,
  fromAngle, angleOf, normalizeAngle, rotateToward,
} from './vec2';

describe('vec2', () => {
  it('adds and subtracts', () => {
    expect(add(vec(1, 2), vec(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(vec(3, 4), vec(1, 2))).toEqual({ x: 2, y: 2 });
  });

  it('scales and measures length', () => {
    expect(scale(vec(2, 3), 2)).toEqual({ x: 4, y: 6 });
    expect(length(vec(3, 4))).toBe(5);
    expect(distance(vec(0, 0), vec(0, 5))).toBe(5);
  });

  it('normalizes to unit length and handles zero', () => {
    const n = normalize(vec(0, 10));
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
    expect(normalize(vec(0, 0))).toEqual({ x: 0, y: 0 });
  });

  it('converts between angle and vector', () => {
    const v = fromAngle(0);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
    expect(angleOf(vec(0, 1))).toBeCloseTo(Math.PI / 2);
  });

  it('normalizes angles into (-PI, PI]', () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it('rotates toward a target without overshooting', () => {
    // target is +90deg away, max step 30deg -> ends at +30deg
    expect(rotateToward(0, Math.PI / 2, Math.PI / 6)).toBeCloseTo(Math.PI / 6);
    // within step -> snaps to target
    expect(rotateToward(0, 0.1, 1)).toBeCloseTo(0.1);
    // shortest path goes the short way (through ±PI), not the long way:
    // from -3 toward 3 the short direction is negative; a 0.5 step moves 0.5 rad.
    const stepped = rotateToward(-3, 3, 0.5);
    expect(Math.abs(normalizeAngle(stepped - (-3)))).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/math/vec2.test.ts`
Expected: FAIL — module `./vec2` not found.

- [ ] **Step 3: Implement `src/math/vec2.ts`**

```ts
export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}

export const fromAngle = (rad: number): Vec2 => ({ x: Math.cos(rad), y: Math.sin(rad) });
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);

/** Wrap an angle into (-PI, PI]. */
export function normalizeAngle(rad: number): number {
  let a = rad % (2 * Math.PI);
  if (a <= -Math.PI) a += 2 * Math.PI;
  if (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/** Step `current` toward `target` by at most `maxDelta`, taking the short way around. */
export function rotateToward(current: number, target: number, maxDelta: number): number {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxDelta) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(diff) * maxDelta);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/math/vec2.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/math/
git commit -m "feat: add vec2 math helpers"
```

---

## Task 2: Constants & shared types

**Files:**
- Create: `src/game/constants.ts`, `src/game/types.ts`

No test (pure declarations). These are consumed and thereby exercised by later tested tasks.

- [ ] **Step 1: Create `src/game/constants.ts`**

```ts
// All tunable gameplay numbers live here so balancing is a one-file change.

// Body shape
export const SEGMENT_SPACING = 6;     // world units between body points
export const START_SEGMENTS = 8;      // body points at spawn
export const BASE_RADIUS = 9;         // segment radius (px world units) at mass 0
export const GIRTH_FACTOR = 1.3;      // radius added per sqrt(mass)
export const MASS_PER_SEGMENT = 4;    // mass needed to add one body point

// Movement (same rules for every snake on every difficulty)
export const WORLD_RADIUS = 1900;     // arena radius — identical on all difficulties
export const BASE_SPEED = 120;        // world units/sec for every snake
export const TURN_RATE = 3.2;         // player max turn (rad/sec)
export const BOT_TURN_RATE = 2.6;     // bot max turn (rad/sec)

// Growth / food
export const START_MASS = 12;
export const FOOD_RADIUS = 5;
export const FOOD_VALUE = 1;          // mass per normal pellet
export const FOOD_DENSITY = 0.00009;  // target pellets per world unit^2
export const DEATH_FOOD_SPACING = 14; // gap between pellets dropped by a dead snake
export const DEATH_FOOD_VALUE = 2;    // mass per death pellet (glowing/big)

// Boost
export const MIN_BOOST_MASS = 14;     // can't boost below this
export const BOOST_DRAIN = 6;         // mass/sec lost while boosting
export const BOOST_MULTIPLIER = 1.8;  // speed multiplier while boosting
export const BOOST_DROP_INTERVAL = 0.15; // seconds between dropped pellets while boosting
```

- [ ] **Step 2: Create `src/game/types.ts`**

```ts
import type { Vec2 } from '../math/vec2';

export type SnakeId = string;

export interface Snake {
  id: SnakeId;
  name: string;
  isPlayer: boolean;
  skinId: string;
  /** segments[0] is the head; subsequent points trail the head. */
  segments: Vec2[];
  heading: number; // radians, current facing
  mass: number;    // drives both length (segment count) and girth (radius)
  boosting: boolean;
  alive: boolean;
  boostDropTimer: number; // internal: time accumulator for boost food drops
}

export interface Food {
  id: number;
  pos: Vec2;
  value: number;
  big: boolean; // true for glowing pellets from dead snakes
}

export interface World {
  radius: number; // arena is a circle centered at (0,0)
}

export interface GameState {
  world: World;
  snakes: Snake[];
  food: Food[];
  nextFoodId: number;
  tick: number;
}

/** Per-frame player intent produced by the input layer. */
export interface InputState {
  /** Desired heading in radians, or null if the player isn't steering this frame. */
  steerAngle: number | null;
  boost: boolean;
}
```

- [ ] **Step 3: Type-check, then commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add src/game/constants.ts src/game/types.ts
git commit -m "feat: add gameplay constants and shared types"
```

---

## Task 3: Difficulty presets

**Files:**
- Create: `src/config/difficulty.ts`
- Test: `src/config/difficulty.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/difficulty.test.ts
import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_ORDER } from './difficulty';

describe('difficulty presets', () => {
  it('defines easy, normal, hard in order', () => {
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'normal', 'hard']);
  });

  // Difficulty changes ONLY the bot AI (count, aggression, cunning).
  // It never carries game-rule fields like speed or border behavior.
  it('scales bot count, aggression and cunning upward', () => {
    const e = DIFFICULTIES.easy, n = DIFFICULTIES.normal, h = DIFFICULTIES.hard;
    expect(e.botCount).toBeLessThan(n.botCount);
    expect(n.botCount).toBeLessThan(h.botCount);
    expect(e.aggression).toBeLessThan(h.aggression);
    expect(e.cunning).toBeLessThan(h.cunning);
  });

  it('does not expose any game-rule fields', () => {
    const keys = Object.keys(DIFFICULTIES.normal).sort();
    expect(keys).toEqual(['aggression', 'botCount', 'cunning']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/config/difficulty.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config/difficulty.ts`**

```ts
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

// NOTE: Difficulty tunes ONLY the bot AI. Game rules (speed, world size, border
// death, collisions, growth) are constants shared across every difficulty and live
// in src/game/constants.ts — they must never be added here.
export interface DifficultySettings {
  botCount: number;    // number of AI opponents
  aggression: number;  // 0..1: chance a bot actively hunts / cuts off the player
  cunning: number;     // 0..1: bot decision quality (look-ahead for avoiding & hunting)
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy:   { botCount: 5,  aggression: 0.05, cunning: 0.25 },
  normal: { botCount: 10, aggression: 0.4,  cunning: 0.6 },
  hard:   { botCount: 16, aggression: 0.85, cunning: 1.0 },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/config/difficulty.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/
git commit -m "feat: add difficulty presets"
```

---

## Task 4: Snake body model (growth, girth, movement)

**Files:**
- Create: `src/game/snake.ts`
- Test: `src/game/snake.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/snake.test.ts
import { describe, it, expect } from 'vitest';
import { vec, distance } from '../math/vec2';
import { createSnake, radiusForMass, desiredSegments, stepSnake, applyGrowth } from './snake';
import { SEGMENT_SPACING, START_MASS, START_SEGMENTS } from './constants';

describe('snake model', () => {
  it('creates a snake facing its heading with START_SEGMENTS points', () => {
    const s = createSnake({ id: 'p', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    expect(s.segments.length).toBe(START_SEGMENTS);
    expect(s.mass).toBe(START_MASS);
    // body trails behind the head along -heading
    expect(s.segments[0].x).toBeGreaterThan(s.segments[1].x);
  });

  it('girth grows with mass', () => {
    expect(radiusForMass(100)).toBeGreaterThan(radiusForMass(10));
  });

  it('desired segment count grows with mass', () => {
    expect(desiredSegments(START_MASS)).toBe(START_SEGMENTS);
    expect(desiredSegments(START_MASS + 40)).toBeGreaterThan(START_SEGMENTS);
  });

  it('moves the head forward and drags the body at fixed spacing', () => {
    const s = createSnake({ id: 'p', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    const startHead = { ...s.segments[0] };
    stepSnake(s, 100, 1); // speed 100, dt 1 -> head moves +100 in x
    expect(s.segments[0].x).toBeCloseTo(startHead.x + 100, 1);
    // spacing between consecutive points stays ~SEGMENT_SPACING
    const gap = distance(s.segments[0], s.segments[1]);
    expect(gap).toBeCloseTo(SEGMENT_SPACING, 0);
  });

  it('applyGrowth appends body points as mass increases', () => {
    const s = createSnake({ id: 'p', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    s.mass = START_MASS + 80;
    applyGrowth(s);
    expect(s.segments.length).toBe(desiredSegments(s.mass));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/game/snake.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/snake.ts`**

```ts
import { Vec2, vec, add, sub, scale, length, normalize, fromAngle } from '../math/vec2';
import type { Snake } from './types';
import {
  SEGMENT_SPACING, START_SEGMENTS, BASE_RADIUS, GIRTH_FACTOR,
  MASS_PER_SEGMENT, START_MASS,
} from './constants';

export interface CreateSnakeParams {
  id: string;
  name: string;
  isPlayer: boolean;
  skinId: string;
  pos: Vec2;     // head position
  heading: number;
}

/** Segment radius (world units) for a given mass. */
export function radiusForMass(mass: number): number {
  return BASE_RADIUS + Math.sqrt(Math.max(0, mass)) * GIRTH_FACTOR;
}

/** How many body points a snake should have at a given mass. */
export function desiredSegments(mass: number): number {
  const extra = Math.floor((mass - START_MASS) / MASS_PER_SEGMENT);
  return Math.max(START_SEGMENTS, START_SEGMENTS + extra);
}

export function createSnake(p: CreateSnakeParams): Snake {
  const dir = fromAngle(p.heading);
  const segments: Vec2[] = [];
  for (let i = 0; i < START_SEGMENTS; i++) {
    segments.push(sub(p.pos, scale(dir, i * SEGMENT_SPACING)));
  }
  return {
    id: p.id,
    name: p.name,
    isPlayer: p.isPlayer,
    skinId: p.skinId,
    segments,
    heading: p.heading,
    mass: START_MASS,
    boosting: false,
    alive: true,
    boostDropTimer: 0,
  };
}

/** Advance the head by speed*dt along `heading`, then drag each body point to keep spacing. */
export function stepSnake(s: Snake, speed: number, dt: number): void {
  const dir = fromAngle(s.heading);
  s.segments[0] = add(s.segments[0], scale(dir, speed * dt));
  for (let i = 1; i < s.segments.length; i++) {
    const ahead = s.segments[i - 1];
    const cur = s.segments[i];
    const d = sub(ahead, cur);
    const dist = length(d);
    if (dist > SEGMENT_SPACING) {
      s.segments[i] = add(cur, scale(normalize(d), dist - SEGMENT_SPACING));
    }
  }
}

/** Reconcile body-point count with current mass (append at tail / trim from tail). */
export function applyGrowth(s: Snake): void {
  const want = desiredSegments(s.mass);
  while (s.segments.length < want) {
    const tail = s.segments[s.segments.length - 1];
    const prev = s.segments[s.segments.length - 2] ?? add(tail, vec(SEGMENT_SPACING, 0));
    // new point continues the tail direction
    const back = normalize(sub(tail, prev));
    s.segments.push(add(tail, scale(back, SEGMENT_SPACING)));
  }
  while (s.segments.length > want && s.segments.length > 2) {
    s.segments.pop();
  }
}

/** Convenience: current head position. */
export const head = (s: Snake): Vec2 => s.segments[0];

/** Current girth radius. */
export const snakeRadius = (s: Snake): number => radiusForMass(s.mass);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/game/snake.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/snake.ts src/game/snake.test.ts
git commit -m "feat: add snake body model with mass-driven girth and length"
```

---

## Task 5: Food field (spawn, eat, death-burst)

**Files:**
- Create: `src/game/food.ts`
- Test: `src/game/food.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/food.test.ts
import { describe, it, expect } from 'vitest';
import { vec } from '../math/vec2';
import { createSnake } from './snake';
import { makeFood, tryEat, burstFromSnake, targetFoodCount } from './food';
import type { GameState } from './types';
import { FOOD_VALUE } from './constants';

function blankState(): GameState {
  return { world: { radius: 1000 }, snakes: [], food: [], nextFoodId: 1, tick: 0 };
}

describe('food', () => {
  it('creates food with an incrementing id', () => {
    const st = blankState();
    const f = makeFood(st, vec(10, 0), FOOD_VALUE, false);
    expect(f.id).toBe(1);
    expect(st.nextFoodId).toBe(2);
    expect(f.pos).toEqual({ x: 10, y: 0 });
  });

  it('eats food within reach and adds its value to mass', () => {
    const st = blankState();
    const s = createSnake({ id: 'p', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    st.snakes.push(s);
    st.food.push(makeFood(st, vec(2, 0), 5, false)); // very close to head
    const massBefore = s.mass;
    tryEat(st, s);
    expect(st.food.length).toBe(0);
    expect(s.mass).toBe(massBefore + 5);
  });

  it('does not eat food that is far away', () => {
    const st = blankState();
    const s = createSnake({ id: 'p', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    st.snakes.push(s);
    st.food.push(makeFood(st, vec(500, 0), 5, false));
    tryEat(st, s);
    expect(st.food.length).toBe(1);
  });

  it('bursts a dead snake into multiple glowing pellets', () => {
    const st = blankState();
    const s = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    s.mass = 60;
    const before = st.food.length;
    burstFromSnake(st, s);
    expect(st.food.length).toBeGreaterThan(before);
    expect(st.food.every((f) => f.big)).toBe(true);
  });

  it('targetFoodCount scales with world size', () => {
    expect(targetFoodCount({ radius: 2000 })).toBeGreaterThan(targetFoodCount({ radius: 1000 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/game/food.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/food.ts`**

```ts
import { Vec2, vec, distance } from '../math/vec2';
import type { Food, GameState, Snake, World } from './types';
import { snakeRadius } from './snake';
import {
  FOOD_RADIUS, FOOD_DENSITY, DEATH_FOOD_SPACING, DEATH_FOOD_VALUE,
} from './constants';

export function makeFood(state: GameState, pos: Vec2, value: number, big: boolean): Food {
  const f: Food = { id: state.nextFoodId++, pos, value, big };
  state.food.push(f);
  return f;
}

/** Eat any food whose center is within (head radius + food radius) of the snake's head. */
export function tryEat(state: GameState, s: Snake): void {
  const reach = snakeRadius(s) + FOOD_RADIUS;
  const headPos = s.segments[0];
  const remaining: Food[] = [];
  for (const f of state.food) {
    if (distance(headPos, f.pos) <= reach) {
      s.mass += f.value;
    } else {
      remaining.push(f);
    }
  }
  state.food = remaining;
}

/** Drop a line of glowing pellets along a dead snake's body. */
export function burstFromSnake(state: GameState, s: Snake): void {
  let acc = 0;
  for (let i = 0; i < s.segments.length; i++) {
    acc += DEATH_FOOD_SPACING;
    if (acc >= DEATH_FOOD_SPACING) {
      acc = 0;
      makeFood(state, { ...s.segments[i] }, DEATH_FOOD_VALUE, true);
    }
  }
}

/** Desired ambient food count for a world (area * density). */
export function targetFoodCount(world: World): number {
  const area = Math.PI * world.radius * world.radius;
  return Math.round(area * FOOD_DENSITY);
}

/** A uniformly random point inside the circular world (excludes a margin near the border). */
export function randomWorldPoint(world: World, rng: () => number): Vec2 {
  const r = Math.sqrt(rng()) * (world.radius * 0.95);
  const a = rng() * Math.PI * 2;
  return vec(Math.cos(a) * r, Math.sin(a) * r);
}

/** Top up ambient food toward the target count. */
export function replenishFood(state: GameState, rng: () => number): void {
  const target = targetFoodCount(state.world);
  const ambient = state.food.filter((f) => !f.big).length;
  for (let i = ambient; i < target; i++) {
    makeFood(state, randomWorldPoint(state.world, rng), 1, false);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/game/food.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/food.ts src/game/food.test.ts
git commit -m "feat: add food field, eating, and death-burst"
```

---

## Task 6: Collision detection (body & border)

**Files:**
- Create: `src/game/collision.ts`
- Test: `src/game/collision.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/collision.test.ts
import { describe, it, expect } from 'vitest';
import { vec } from '../math/vec2';
import { createSnake } from './snake';
import { headHitsSnake, headOutsideBorder } from './collision';

describe('collision', () => {
  it('detects a head striking another snake body', () => {
    const a = createSnake({ id: 'a', name: 'A', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    // B's body lies right on A's head
    const b = createSnake({ id: 'b', name: 'B', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: Math.PI / 2 });
    expect(headHitsSnake(a, b)).toBe(true);
  });

  it('ignores snakes that are far apart', () => {
    const a = createSnake({ id: 'a', name: 'A', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    const b = createSnake({ id: 'b', name: 'B', isPlayer: false, skinId: 'blue', pos: vec(800, 800), heading: 0 });
    expect(headHitsSnake(a, b)).toBe(false);
  });

  it('does not flag a snake colliding with its own neck', () => {
    const a = createSnake({ id: 'a', name: 'A', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    expect(headHitsSnake(a, a)).toBe(false);
  });

  it('detects the head leaving the circular world', () => {
    const a = createSnake({ id: 'a', name: 'A', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    expect(headOutsideBorder(a, { radius: 1000 })).toBe(false);
    a.segments[0] = vec(1001, 0);
    expect(headOutsideBorder(a, { radius: 1000 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/game/collision.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/collision.ts`**

```ts
import { distance, length as vlen } from '../math/vec2';
import type { Snake, World } from './types';
import { snakeRadius } from './snake';
import { SEGMENT_SPACING } from './constants';

/** Number of leading body points a snake cannot collide with on itself (its own neck). */
const SELF_SKIP = 4;

/**
 * True if `attacker`'s head overlaps any body segment of `victim`.
 * When attacker === victim, the first SELF_SKIP points are ignored (the neck).
 */
export function headHitsSnake(attacker: Snake, victim: Snake): boolean {
  if (!attacker.alive || !victim.alive) return false;
  const headPos = attacker.segments[0];
  const hitDist = snakeRadius(attacker) * 0.6 + snakeRadius(victim) * 0.6;
  const startIndex = attacker === victim ? SELF_SKIP : 0;
  // broad-phase: skip distant snakes cheaply
  if (attacker !== victim) {
    const span = victim.segments.length * SEGMENT_SPACING + snakeRadius(victim) + snakeRadius(attacker);
    if (distance(headPos, victim.segments[0]) > span) return false;
  }
  for (let i = startIndex; i < victim.segments.length; i++) {
    if (distance(headPos, victim.segments[i]) <= hitDist) return true;
  }
  return false;
}

/** True if the snake's head center is beyond the world radius. */
export function headOutsideBorder(s: Snake, world: World): boolean {
  return vlen(s.segments[0]) > world.radius;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/game/collision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/collision.ts src/game/collision.test.ts
git commit -m "feat: add body and border collision detection"
```

---

## Task 7: Leaderboard & King selection

**Files:**
- Create: `src/game/leaderboard.ts`
- Test: `src/game/leaderboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/leaderboard.test.ts
import { describe, it, expect } from 'vitest';
import { vec } from '../math/vec2';
import { createSnake } from './snake';
import { scoreOf, ranking, kingId } from './leaderboard';
import type { Snake } from './types';

function snakeWithMass(id: string, mass: number, alive = true): Snake {
  const s = createSnake({ id, name: id, isPlayer: id === 'you', skinId: 'pink', pos: vec(0, 0), heading: 0 });
  s.mass = mass;
  s.alive = alive;
  return s;
}

describe('leaderboard', () => {
  it('score is floored mass', () => {
    expect(scoreOf(snakeWithMass('a', 42.9))).toBe(42);
  });

  it('ranks alive snakes by score descending', () => {
    const snakes = [snakeWithMass('a', 10), snakeWithMass('b', 50), snakeWithMass('c', 30)];
    expect(ranking(snakes).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('excludes dead snakes from the ranking', () => {
    const snakes = [snakeWithMass('a', 10), snakeWithMass('b', 99, false)];
    expect(ranking(snakes).map((s) => s.id)).toEqual(['a']);
  });

  it('king is the highest-scoring alive snake', () => {
    const snakes = [snakeWithMass('a', 10), snakeWithMass('b', 50), snakeWithMass('you', 30)];
    expect(kingId(snakes)).toBe('b');
  });

  it('king is null when no snakes are alive', () => {
    expect(kingId([snakeWithMass('a', 10, false)])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/game/leaderboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/leaderboard.ts`**

```ts
import type { Snake, SnakeId } from './types';

export const scoreOf = (s: Snake): number => Math.floor(s.mass);

/** Alive snakes sorted by score, highest first. */
export function ranking(snakes: Snake[]): Snake[] {
  return snakes.filter((s) => s.alive).sort((a, b) => scoreOf(b) - scoreOf(a));
}

/** Id of the current King (top-ranked alive snake), or null if none alive. */
export function kingId(snakes: Snake[]): SnakeId | null {
  const r = ranking(snakes);
  return r.length > 0 ? r[0].id : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/game/leaderboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/leaderboard.ts src/game/leaderboard.test.ts
git commit -m "feat: add leaderboard ranking and King selection"
```

---

## Task 8: Bot AI steering

**Files:**
- Create: `src/game/bots.ts`
- Test: `src/game/bots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/bots.test.ts
import { describe, it, expect } from 'vitest';
import { vec, fromAngle } from '../math/vec2';
import { createSnake } from './snake';
import { makeFood } from './food';
import { decideHeading, decideBoost } from './bots';
import type { GameState } from './types';
import { DIFFICULTIES } from '../config/difficulty';
import { MIN_BOOST_MASS } from './constants';

function state(radius = 1000): GameState {
  return { world: { radius }, snakes: [], food: [], nextFoodId: 1, tick: 0 };
}

describe('bot AI', () => {
  it('steers toward the nearest food', () => {
    const st = state();
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    st.snakes.push(bot);
    makeFood(st, vec(0, 200), 1, false); // food straight "down" (+y)
    const target = decideHeading(st, bot, DIFFICULTIES.normal, () => 0.5);
    // heading should point roughly toward +y (PI/2)
    expect(Math.abs(target - Math.PI / 2)).toBeLessThan(0.6);
  });

  it('steers back inward when near the border', () => {
    const st = state(300);
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(290, 0), heading: 0 });
    bot.heading = 0; // heading straight out toward +x border
    st.snakes.push(bot);
    const target = decideHeading(st, bot, DIFFICULTIES.normal, () => 0.5);
    // desired direction should have a negative x component (back toward center)
    const dir = fromAngle(target);
    expect(dir.x).toBeLessThan(0.3);
  });

  it('does not boost when low on mass', () => {
    const st = state();
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    bot.mass = MIN_BOOST_MASS; // at the floor — must keep its buffer
    st.snakes.push(bot);
    expect(decideBoost(st, bot, DIFFICULTIES.hard, () => 0)).toBe(false);
  });

  it('boosts to chase a smaller, nearby player when aggressive', () => {
    const st = state();
    const player = createSnake({ id: 'player', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(50, 0), heading: 0 });
    player.mass = 20;
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    bot.mass = 100;
    st.snakes.push(player, bot);
    expect(decideBoost(st, bot, DIFFICULTIES.hard, () => 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/game/bots.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/bots.ts`**

```ts
import { Vec2, sub, add, scale, distance, length as vlen, angleOf, fromAngle } from '../math/vec2';
import type { GameState, Snake } from './types';
import type { DifficultySettings } from '../config/difficulty';
import { snakeRadius } from './snake';
import { MIN_BOOST_MASS } from './constants';

const BORDER_LOOKAHEAD = 160; // start turning inward within this distance of the border
const AVOID_LOOKAHEAD = 90;   // distance ahead to check for other bodies

/**
 * Decide the heading a bot wants this frame. Priority: avoid the border, avoid
 * imminent body collisions, (optionally) hunt the player, else seek nearest food.
 * `rng` is injectable for deterministic tests.
 */
export function decideHeading(
  state: GameState,
  bot: Snake,
  settings: DifficultySettings,
  rng: () => number,
): number {
  const headPos = bot.segments[0];

  // 1) Border avoidance: if near the edge, steer toward center.
  const distFromCenter = vlen(headPos);
  if (state.world.radius - distFromCenter < BORDER_LOOKAHEAD) {
    return angleOf(scale(headPos, -1)); // point back toward (0,0)
  }

  // 2) Body avoidance: if a foreign body point is close ahead, veer away from it.
  // Look-ahead scales with cunning: low-cunning (easy) bots see less and crash more.
  const lookahead = AVOID_LOOKAHEAD * (0.4 + settings.cunning);
  const ahead = add(headPos, scale(fromAngle(bot.heading), lookahead));
  let threat: Vec2 | null = null;
  let threatDist = Infinity;
  for (const other of state.snakes) {
    if (!other.alive) continue;
    const startIndex = other === bot ? 6 : 0;
    for (let i = startIndex; i < other.segments.length; i += 2) {
      const d = distance(ahead, other.segments[i]);
      if (d < snakeRadius(bot) + snakeRadius(other) && d < threatDist) {
        threat = other.segments[i];
        threatDist = d;
      }
    }
  }
  if (threat) {
    const away = sub(headPos, threat);
    return angleOf(away);
  }

  // 3) Hunt the player (aggression chance) if the player is alive and smaller.
  const player = state.snakes.find((s) => s.isPlayer && s.alive);
  if (player && rng() < settings.aggression && player.mass < bot.mass * 1.2) {
    // aim slightly ahead of the player's head to cut them off
    const lead = add(player.segments[0], scale(fromAngle(player.heading), snakeRadius(player) * 3));
    return angleOf(sub(lead, headPos));
  }

  // 4) Seek nearest food.
  let nearest: Vec2 | null = null;
  let best = Infinity;
  for (const f of state.food) {
    const d = distance(headPos, f.pos);
    if (d < best) { best = d; nearest = f.pos; }
  }
  if (nearest) return angleOf(sub(nearest, headPos));

  // 5) Wander: keep current heading with a small random nudge.
  return bot.heading + (rng() - 0.5) * 0.4;
}

/**
 * Decide whether a bot boosts this frame. Bots boost (like the player) to chase a smaller,
 * nearby player and cut them off, or occasionally to dash for very close food. Boosting
 * sheds mass, so bots keep a buffer above MIN_BOOST_MASS. Frequency scales with the bot's
 * aggression (hunting) and cunning (food dashes). `rng` is injectable for deterministic tests.
 */
export function decideBoost(
  state: GameState,
  bot: Snake,
  settings: DifficultySettings,
  rng: () => number,
): boolean {
  if (bot.mass <= MIN_BOOST_MASS + 6) return false; // keep a safety buffer

  const player = state.snakes.find((s) => s.isPlayer && s.alive);
  if (player) {
    const d = distance(bot.segments[0], player.segments[0]);
    if (d < 220 && bot.mass > player.mass && rng() < settings.aggression) return true;
  }

  let nearestFood = Infinity;
  for (const f of state.food) {
    const d = distance(bot.segments[0], f.pos);
    if (d < nearestFood) nearestFood = d;
  }
  if (nearestFood < 120 && rng() < settings.cunning * 0.1) return true;

  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/game/bots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/bots.ts src/game/bots.test.ts
git commit -m "feat: add bot AI steering"
```

---

## Task 9: Simulation orchestration

**Files:**
- Create: `src/game/simulation.ts`
- Test: `src/game/simulation.test.ts`

This wires the model together: `createGame()` builds the initial state, and `update()` advances one step (input → steering → movement → eating → growth → collisions → respawn → food top-up).

- [ ] **Step 1: Write the failing test**

```ts
// src/game/simulation.test.ts
import { describe, it, expect } from 'vitest';
import { createGame, update, PLAYER_ID } from './simulation';
import { DIFFICULTIES } from '../config/difficulty';
import { makeFood } from './food';
import { scoreOf } from './leaderboard';

const seedRng = () => 0.5; // deterministic

describe('simulation', () => {
  it('creates a player plus the configured number of bots', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID);
    expect(player).toBeDefined();
    expect(player!.isPlayer).toBe(true);
    const bots = st.snakes.filter((s) => !s.isPlayer);
    expect(bots.length).toBe(DIFFICULTIES.normal.botCount);
  });

  it('moves the player toward the steered heading over time', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    const startX = player.segments[0].x;
    for (let i = 0; i < 30; i++) {
      update(st, 1 / 60, { steerAngle: 0, boost: false }, DIFFICULTIES.normal, seedRng);
    }
    expect(player.segments[0].x).toBeGreaterThan(startX);
  });

  it('grows the player when it eats nearby food', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    const before = scoreOf(player);
    makeFood(st, { ...player.segments[0] }, 10, false);
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.normal, seedRng);
    expect(scoreOf(player)).toBeGreaterThan(before);
  });

  it('kills the player on a border crossing and bursts food', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    player.segments[0] = { x: st.world.radius + 50, y: 0 };
    const foodBefore = st.food.length;
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.normal, seedRng);
    expect(player.alive).toBe(false);
    expect(st.food.length).toBeGreaterThan(foodBefore);
  });

  it('border is deadly on easy too (rules are difficulty-independent)', () => {
    const st = createGame('easy', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    player.segments[0] = { x: st.world.radius + 50, y: 0 };
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.easy, seedRng);
    expect(player.alive).toBe(false);
  });

  it('uses the same world size on every difficulty', () => {
    const easy = createGame('easy', 'pink', seedRng);
    const hard = createGame('hard', 'pink', seedRng);
    expect(easy.world.radius).toBe(hard.world.radius);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/game/simulation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/simulation.ts`**

```ts
import { vec, rotateToward } from '../math/vec2';
import type { GameState, InputState, Snake } from './types';
import type { Difficulty, DifficultySettings } from '../config/difficulty';
import { DIFFICULTIES } from '../config/difficulty';
import { createSnake, stepSnake, applyGrowth } from './snake';
import { tryEat, burstFromSnake, replenishFood, randomWorldPoint } from './food';
import { headHitsSnake, headOutsideBorder } from './collision';
import { decideHeading, decideBoost } from './bots';
import {
  WORLD_RADIUS, BASE_SPEED, TURN_RATE, BOT_TURN_RATE, MIN_BOOST_MASS, BOOST_DRAIN,
  BOOST_MULTIPLIER, BOOST_DROP_INTERVAL, FOOD_VALUE, START_MASS,
} from './constants';

export const PLAYER_ID = 'player';

const BOT_NAMES = [
  'Rex', 'Biscuit', 'Sparkle', 'Zoom', 'Noodle', 'Fang', 'Pebble', 'Sunny',
  'Dash', 'Mango', 'Boots', 'Cosmo', 'Pixel', 'Ziggy', 'Coco', 'Tank',
];
const SKIN_IDS = ['pink', 'blue', 'green', 'dragon', 'dog', 'rainbow', 'sun', 'mint'];

export function createGame(difficulty: Difficulty, playerSkinId: string, rng: () => number): GameState {
  const settings = DIFFICULTIES[difficulty];
  const state: GameState = {
    world: { radius: WORLD_RADIUS },
    snakes: [],
    food: [],
    nextFoodId: 1,
    tick: 0,
  };

  state.snakes.push(createSnake({
    id: PLAYER_ID, name: 'You', isPlayer: true, skinId: playerSkinId,
    pos: vec(0, 0), heading: 0,
  }));

  for (let i = 0; i < settings.botCount; i++) {
    const pos = randomWorldPoint(state.world, rng);
    state.snakes.push(createSnake({
      id: `bot${i}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isPlayer: false,
      skinId: SKIN_IDS[i % SKIN_IDS.length],
      pos,
      heading: rng() * Math.PI * 2,
    }));
  }

  replenishFood(state, rng);
  return state;
}

function speedFor(s: Snake): number {
  return s.boosting ? BASE_SPEED * BOOST_MULTIPLIER : BASE_SPEED;
}

/** Advance the whole game by `dt` seconds. */
export function update(
  state: GameState,
  dt: number,
  input: InputState,
  settings: DifficultySettings,
  rng: () => number,
): void {
  state.tick++;

  // 1) Choose target headings + boost intent for every snake.
  for (const s of state.snakes) {
    if (!s.alive) continue;
    let targetHeading = s.heading;
    if (s.isPlayer) {
      if (input.steerAngle !== null) targetHeading = input.steerAngle;
      s.boosting = input.boost && s.mass > MIN_BOOST_MASS;
    } else {
      targetHeading = decideHeading(state, s, settings, rng);
      s.boosting = decideBoost(state, s, settings, rng) && s.mass > MIN_BOOST_MASS;
    }
    const turn = (s.isPlayer ? TURN_RATE : BOT_TURN_RATE) * dt;
    s.heading = rotateToward(s.heading, targetHeading, turn);
  }

  // 2) Move bodies; shed mass + drop pellets while boosting.
  for (const s of state.snakes) {
    if (!s.alive) continue;
    stepSnake(s, speedFor(s), dt);
    if (s.boosting) {
      s.mass = Math.max(START_MASS, s.mass - BOOST_DRAIN * dt);
      s.boostDropTimer += dt;
      if (s.boostDropTimer >= BOOST_DROP_INTERVAL) {
        s.boostDropTimer = 0;
        const tail = s.segments[s.segments.length - 1];
        state.food.push({ id: state.nextFoodId++, pos: { ...tail }, value: FOOD_VALUE, big: false });
      }
    }
    applyGrowth(s);
  }

  // 3) Eating.
  for (const s of state.snakes) {
    if (s.alive) tryEat(state, s);
    applyGrowth(s);
  }

  // 4) Collisions. The border is ALWAYS deadly (every difficulty); then body hits.
  for (const s of state.snakes) {
    if (!s.alive) continue;
    if (headOutsideBorder(s, state.world)) {
      s.alive = false;
      burstFromSnake(state, s);
    }
  }
  for (const s of state.snakes) {
    if (!s.alive) continue;
    for (const other of state.snakes) {
      if (!other.alive) continue;
      if (headHitsSnake(s, other)) {
        s.alive = false;
        burstFromSnake(state, s);
        break;
      }
    }
  }

  // 5) Respawn dead bots so the world stays populated (the player stays dead).
  for (let i = 0; i < state.snakes.length; i++) {
    const s = state.snakes[i];
    if (!s.alive && !s.isPlayer) {
      state.snakes[i] = createSnake({
        id: s.id, name: s.name, isPlayer: false, skinId: s.skinId,
        pos: randomWorldPoint(state.world, rng), heading: rng() * Math.PI * 2,
      });
    }
  }

  // 6) Keep ambient food topped up.
  replenishFood(state, rng);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/game/simulation.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/simulation.ts src/game/simulation.test.ts
git commit -m "feat: add simulation orchestration (createGame + update)"
```

---

## Task 10: Camera (world<->screen transform)

**Files:**
- Create: `src/render/camera.ts`
- Test: `src/render/camera.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/render/camera.test.ts
import { describe, it, expect } from 'vitest';
import { vec } from '../math/vec2';
import { makeCamera, worldToScreen } from './camera';

describe('camera', () => {
  it('places the focus point at the screen center', () => {
    const cam = makeCamera(vec(100, 100), 800, 600);
    const p = worldToScreen(cam, vec(100, 100));
    expect(p.x).toBeCloseTo(400);
    expect(p.y).toBeCloseTo(300);
  });

  it('offsets other points relative to the focus', () => {
    const cam = makeCamera(vec(0, 0), 800, 600);
    const p = worldToScreen(cam, vec(10, 0));
    expect(p.x).toBeCloseTo(400 + 10 * cam.zoom);
    expect(p.y).toBeCloseTo(300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/render/camera.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/render/camera.ts`**

```ts
import { Vec2, vec } from '../math/vec2';

export interface Camera {
  focus: Vec2;     // world point shown at screen center
  width: number;
  height: number;
  zoom: number;    // screen px per world unit
}

export function makeCamera(focus: Vec2, width: number, height: number, zoom = 1): Camera {
  return { focus, width, height, zoom };
}

export function worldToScreen(cam: Camera, p: Vec2): Vec2 {
  return vec(
    (p.x - cam.focus.x) * cam.zoom + cam.width / 2,
    (p.y - cam.focus.y) * cam.zoom + cam.height / 2,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/render/camera.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/camera.ts src/render/camera.test.ts
git commit -m "feat: add follow-camera transform"
```

---

## Task 11: localStorage persistence

**Files:**
- Create: `src/persistence/storage.ts`
- Test: `src/persistence/storage.test.ts` (runs under jsdom — configured in Task 0)

- [ ] **Step 1: Write the failing test**

```ts
// src/persistence/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBestScore, setBestScore, getSkin, setSkin, getDifficulty, setDifficulty,
  getMuted, setMuted, getMouseControl, setMouseControl,
} from './storage';

describe('persistence', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to unmuted and round-trips the mute flag', () => {
    expect(getMuted()).toBe(false);
    setMuted(true);
    expect(getMuted()).toBe(true);
    setMuted(false);
    expect(getMuted()).toBe(false);
  });

  it('defaults mouse control off and round-trips it', () => {
    expect(getMouseControl()).toBe(false);
    setMouseControl(true);
    expect(getMouseControl()).toBe(true);
    setMouseControl(false);
    expect(getMouseControl()).toBe(false);
  });

  it('defaults best score to 0 and stores higher scores only', () => {
    expect(getBestScore()).toBe(0);
    setBestScore(50);
    expect(getBestScore()).toBe(50);
    setBestScore(30); // lower -> ignored
    expect(getBestScore()).toBe(50);
  });

  it('round-trips skin and difficulty', () => {
    expect(getSkin()).toBe('pink'); // default
    setSkin('dragon');
    expect(getSkin()).toBe('dragon');

    expect(getDifficulty()).toBe('normal'); // default
    setDifficulty('hard');
    expect(getDifficulty()).toBe('hard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/persistence/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/persistence/storage.ts`**

```ts
import type { Difficulty } from '../config/difficulty';

const KEYS = {
  best: 'snake.best',
  skin: 'snake.skin',
  difficulty: 'snake.difficulty',
  muted: 'snake.muted',
  mouse: 'snake.mouse',
} as const;

export function getBestScore(): number {
  return Number(localStorage.getItem(KEYS.best) ?? '0') || 0;
}
export function setBestScore(score: number): void {
  if (score > getBestScore()) localStorage.setItem(KEYS.best, String(Math.floor(score)));
}

export function getSkin(): string {
  return localStorage.getItem(KEYS.skin) ?? 'pink';
}
export function setSkin(id: string): void {
  localStorage.setItem(KEYS.skin, id);
}

export function getDifficulty(): Difficulty {
  return (localStorage.getItem(KEYS.difficulty) as Difficulty) ?? 'normal';
}
export function setDifficulty(d: Difficulty): void {
  localStorage.setItem(KEYS.difficulty, d);
}

export function getMuted(): boolean {
  return localStorage.getItem(KEYS.muted) === '1';
}
export function setMuted(muted: boolean): void {
  localStorage.setItem(KEYS.muted, muted ? '1' : '0');
}

export function getMouseControl(): boolean {
  return localStorage.getItem(KEYS.mouse) === '1';
}
export function setMouseControl(on: boolean): void {
  localStorage.setItem(KEYS.mouse, on ? '1' : '0');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/persistence/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/
git commit -m "feat: add localStorage persistence"
```

---

## Task 12: Skin roster & procedural drawing

**Files:**
- Create: `src/skins/skins.ts`

No unit test (pure canvas drawing — verified visually in Task 17). Keep the data table and the draw routine in one file.

- [ ] **Step 1: Implement `src/skins/skins.ts`**

```ts
import type { Snake } from '../game/types';
import type { Camera } from '../render/camera';
import { worldToScreen } from '../render/camera';
import { snakeRadius } from '../game/snake';

export interface Skin {
  id: string;
  name: string;
  body: string;       // primary body color
  accent: string;     // stripe/belly accent
  pattern: 'solid' | 'stripes' | 'spots';
  eyes: boolean;
  spikes?: boolean;   // dragon-style back spikes
  ears?: boolean;     // dog-style ears on the head
}

export const SKINS: Skin[] = [
  { id: 'pink',    name: 'Bubblegum', body: '#ff7eb3', accent: '#ffd1e8', pattern: 'solid',   eyes: true },
  { id: 'blue',    name: 'Bluey',     body: '#4dabff', accent: '#bfe3ff', pattern: 'stripes', eyes: true },
  { id: 'green',   name: 'Leafy',     body: '#5ac85a', accent: '#bff0a0', pattern: 'spots',   eyes: true },
  { id: 'dragon',  name: 'Drako',     body: '#3fae6b', accent: '#ffd23f', pattern: 'stripes', eyes: true, spikes: true },
  { id: 'dog',     name: 'Biscuit',   body: '#c98a4b', accent: '#5a3a1e', pattern: 'spots',   eyes: true, ears: true },
  { id: 'rainbow', name: 'Rainbow',   body: '#ff7eb3', accent: '#4dabff', pattern: 'stripes', eyes: true },
  { id: 'sun',     name: 'Sunny',     body: '#ffd23f', accent: '#ff8c1a', pattern: 'stripes', eyes: true },
  { id: 'mint',    name: 'Minty',     body: '#7ef0c8', accent: '#ffffff', pattern: 'spots',   eyes: true },
];

export const getSkin = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** Draw a snake back-to-front so the head sits on top. */
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  s: Snake,
  cam: Camera,
  isKing: boolean,
): void {
  const skin = getSkin(s.skinId);
  const r = snakeRadius(s) * cam.zoom;

  // body
  for (let i = s.segments.length - 1; i >= 0; i--) {
    const p = worldToScreen(cam, s.segments[i]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (skin.pattern === 'stripes' && i % 2 === 0) ctx.fillStyle = skin.accent;
    else ctx.fillStyle = skin.body;
    ctx.fill();
    if (skin.pattern === 'spots' && i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
    if (skin.spikes && i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 1.4);
      ctx.lineTo(p.x - r * 0.5, p.y - r * 0.4);
      ctx.lineTo(p.x + r * 0.5, p.y - r * 0.4);
      ctx.closePath();
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
  }

  // head details
  const head = worldToScreen(cam, s.segments[0]);
  const dir = { x: Math.cos(s.heading), y: Math.sin(s.heading) };
  const side = { x: -dir.y, y: dir.x };
  if (skin.ears) {
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(head.x + side.x * sgn * r, head.y + side.y * sgn * r, r * 0.5, r * 0.8, s.heading, 0, Math.PI * 2);
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
  }
  if (skin.eyes) {
    for (const sgn of [-1, 1]) {
      const ex = head.x + dir.x * r * 0.4 + side.x * sgn * r * 0.5;
      const ey = head.y + dir.y * r * 0.4 + side.y * sgn * r * 0.5;
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.35, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + dir.x * r * 0.12, ey + dir.y * r * 0.12, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#222'; ctx.fill();
    }
  }

  // crown for the King
  if (isKing) {
    const cx = head.x + dir.x * r * 0.2;
    const cy = head.y + dir.y * r * 0.2 - r * 1.6;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#d99e00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.8, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.3, cy + r * 0.15);
    ctx.lineTo(cx, cy - r * 0.4);
    ctx.lineTo(cx + r * 0.3, cy + r * 0.15);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.2);
    ctx.lineTo(cx + r * 0.8, cy + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
```

- [ ] **Step 2: Type-check, then commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add src/skins/
git commit -m "feat: add skin roster and procedural snake drawing with crown"
```

---

## Task 13: Renderer (world, food, snakes)

**Files:**
- Create: `src/render/renderer.ts`

No unit test (canvas drawing — verified visually in Task 17).

- [ ] **Step 1: Implement `src/render/renderer.ts`**

```ts
import type { GameState } from '../game/types';
import type { Camera } from './camera';
import { worldToScreen } from './camera';
import { drawSnake } from '../skins/skins';
import { kingId } from '../game/leaderboard';

export function render(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): void {
  const { width, height } = cam;

  // background
  ctx.fillStyle = '#ffe3a3';
  ctx.fillRect(0, 0, width, height);

  // arena border ring
  const center = worldToScreen(cam, { x: 0, y: 0 });
  ctx.beginPath();
  ctx.arc(center.x, center.y, state.world.radius * cam.zoom, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#e0a85b';
  ctx.stroke();

  // food
  for (const f of state.food) {
    const p = worldToScreen(cam, f.pos);
    if (p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (f.big ? 7 : 5) * cam.zoom, 0, Math.PI * 2);
    ctx.fillStyle = f.big ? '#ffe600' : '#ff8c42';
    if (f.big) { ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 12; }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // snakes (player drawn last so it's on top)
  const king = kingId(state.snakes);
  const ordered = [...state.snakes].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
  for (const s of ordered) {
    if (!s.alive) continue;
    drawSnake(ctx, s, cam, s.id === king);
  }
}
```

- [ ] **Step 2: Type-check, then commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add src/render/renderer.ts
git commit -m "feat: add canvas renderer"
```

---

## Task 14: Touch input (thumbstick + boost)

**Files:**
- Create: `src/input/controls.ts`

No unit test (DOM pointer events — verified by playing in Task 17). Keyboard support is added for desktop dev testing.

- [ ] **Step 1: Implement `src/input/controls.ts`**

```ts
import type { InputState } from '../game/types';

/**
 * Player input. Two modes:
 *  - Touch (primary): a dynamic thumbstick anchored where the player first touches the
 *    left half of the screen, plus a boost zone on the right half.
 *  - Mouse (desktop testing toggle): the snake steers toward the mouse pointer and a mouse
 *    click boosts. The player head is always at screen center, so the steer angle is the
 *    angle from screen center to the pointer.
 * Arrow/WASD + space are also accepted as a keyboard fallback for development.
 */
export class Controls {
  private steerAngle: number | null = null;
  private boost = false;

  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private boostId: number | null = null;

  private mouseMode = false;
  private mouseAngle: number | null = null;
  private mouseBoost = false;

  private keys = new Set<string>();
  private readonly deadZone = 14; // px before steering registers

  constructor(private target: HTMLElement) {
    target.addEventListener('pointerdown', this.onDown, { passive: false });
    target.addEventListener('pointermove', this.onMove, { passive: false });
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', (e) => this.keys.add(e.key));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
  }

  /** Enable/disable desktop mouse mode. Clears any stale mouse state when turned off. */
  setMouseMode(on: boolean): void {
    this.mouseMode = on;
    if (!on) { this.mouseAngle = null; this.mouseBoost = false; }
  }

  /** Expose where the stick is drawn so the HUD can render it. */
  get stick(): { origin: { x: number; y: number }; active: boolean } {
    return { origin: this.stickOrigin, active: this.stickId !== null };
  }

  private angleFromCenter(x: number, y: number): number {
    return Math.atan2(y - window.innerHeight / 2, x - window.innerWidth / 2);
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    if (this.mouseMode && e.pointerType === 'mouse') {
      this.mouseBoost = true;
      this.mouseAngle = this.angleFromCenter(e.clientX, e.clientY);
      return;
    }
    const leftHalf = e.clientX < window.innerWidth / 2;
    if (leftHalf && this.stickId === null) {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
    } else if (!leftHalf && this.boostId === null) {
      this.boostId = e.pointerId;
      this.boost = true;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.mouseMode && e.pointerType === 'mouse') {
      this.mouseAngle = this.angleFromCenter(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId !== this.stickId) return;
    e.preventDefault();
    const dx = e.clientX - this.stickOrigin.x;
    const dy = e.clientY - this.stickOrigin.y;
    if (Math.hypot(dx, dy) >= this.deadZone) this.steerAngle = Math.atan2(dy, dx);
  };

  private onUp = (e: PointerEvent) => {
    if (this.mouseMode && e.pointerType === 'mouse') { this.mouseBoost = false; return; }
    if (e.pointerId === this.stickId) { this.stickId = null; this.steerAngle = null; }
    if (e.pointerId === this.boostId) { this.boostId = null; this.boost = false; }
  };

  /** Read the current intent. Mouse mode (if on) and keyboard override touch state. */
  read(): InputState {
    let angle = this.mouseMode ? this.mouseAngle : this.steerAngle;
    let boost = this.mouseMode ? this.mouseBoost : this.boost;

    let kx = 0, ky = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) kx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('d')) kx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('w')) ky -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('s')) ky += 1;
    if (kx !== 0 || ky !== 0) angle = Math.atan2(ky, kx);
    if (this.keys.has(' ')) boost = true;

    return { steerAngle: angle, boost };
  }
}
```

- [ ] **Step 2: Type-check, then commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add src/input/
git commit -m "feat: add touch thumbstick + boost controls"
```

---

## Task 15: HUD & screens (DOM overlays)

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/screens.ts`
- Modify: `src/style.css` (append HUD/screen styles)

No unit test (DOM rendering — verified in Task 17).

- [ ] **Step 1: Append HUD/screen styles to `src/style.css`**

```css
/* HUD */
.score-pill {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.45); color: #fff; padding: 6px 16px;
  border-radius: 999px; font-weight: 700; font-size: 16px;
}
.leaderboard {
  position: fixed; top: 12px; right: 12px; min-width: 150px;
  background: rgba(255,255,255,0.6); backdrop-filter: blur(4px);
  border-radius: 10px; padding: 8px 10px; font-size: 14px; line-height: 1.7;
}
.leaderboard h4 { font-size: 13px; border-bottom: 1px solid rgba(0,0,0,0.15); margin-bottom: 4px; }
.leaderboard .you { color: #d2447a; font-weight: 700; }
.minimap { position: fixed; bottom: 12px; right: 12px; background: rgba(0,0,0,0.3); border-radius: 10px; }
.boost-btn {
  position: fixed; bottom: 16px; right: 96px; width: 76px; height: 76px;
  border-radius: 50%; background: rgba(255,126,179,0.8); color: #fff;
  border: 3px solid rgba(255,255,255,0.6); font-weight: 800; font-size: 14px;
}
.mute-btn {
  position: fixed; top: 12px; left: 12px; width: 44px; height: 44px;
  border-radius: 50%; background: rgba(0,0,0,0.35); color: #fff;
  border: none; font-size: 20px;
}
.king-flash {
  position: fixed; top: 30%; left: 50%; transform: translateX(-50%);
  font-size: 40px; font-weight: 900; color: #ffd23f; text-shadow: 0 2px 0 #b97e00;
  animation: kingpop 1.6s ease forwards; pointer-events: none;
}
@keyframes kingpop { 0% {opacity:0; transform:translateX(-50%) scale(0.5);} 20%{opacity:1; transform:translateX(-50%) scale(1.1);} 80%{opacity:1;} 100%{opacity:0;} }

/* Screens */
.screen {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(circle at 50% 30%, #fff6d5, #ffd27a);
  text-align: center; padding: 24px;
}
.screen h1 { font-size: clamp(40px, 9vw, 96px); color: #ff5fa2; text-shadow: 0 4px 0 #d2447a; }
.btn { font-size: 22px; font-weight: 800; padding: 14px 34px; border: none; border-radius: 16px;
       background: #ff7eb3; color: #fff; box-shadow: 0 4px 0 #d2447a; }
.btn.secondary { background: #4dabff; box-shadow: 0 4px 0 #2b7fcf; }
.diff-row, .skin-row { display: flex; gap: 12px; align-items: center; }
.chip { padding: 10px 18px; border-radius: 999px; background: #fff; border: 3px solid transparent; font-weight: 700; }
.chip.selected { border-color: #ff5fa2; }
.skin-swatch { width: 64px; height: 64px; border-radius: 50%; border: 4px solid #fff; }
.skin-swatch.selected { border-color: #ff5fa2; }
.mouse-toggle { display: flex; align-items: center; gap: 8px; font-size: 16px; color: #7a4a2a; }
```

- [ ] **Step 2: Implement `src/ui/hud.ts`**

```ts
import type { GameState } from '../game/types';
import { ranking, scoreOf, kingId } from '../game/leaderboard';
import type { Camera } from '../render/camera';

export class Hud {
  private root: HTMLElement;
  private scoreEl: HTMLElement;
  private boardEl: HTMLElement;
  private minimap: HTMLCanvasElement;
  private mmCtx: CanvasRenderingContext2D;
  private wasKing = false;

  constructor(mount: HTMLElement) {
    this.root = mount;
    this.root.innerHTML = `
      <div class="score-pill" id="score"></div>
      <div class="leaderboard"><h4>Leaderboard</h4><div id="board"></div></div>
      <canvas class="minimap" id="minimap" width="120" height="90"></canvas>
      <button class="boost-btn" id="boost">BOOST</button>
      <button class="mute-btn" id="mute">🔊</button>
    `;
    this.scoreEl = this.root.querySelector('#score')!;
    this.boardEl = this.root.querySelector('#board')!;
    this.minimap = this.root.querySelector('#minimap') as HTMLCanvasElement;
    this.mmCtx = this.minimap.getContext('2d')!;
  }

  update(state: GameState, playerId: string, best: number, _cam: Camera): void {
    const ranked = ranking(state.snakes);
    const player = state.snakes.find((s) => s.id === playerId);
    const king = kingId(state.snakes);

    this.scoreEl.textContent = `Length ${player ? scoreOf(player) : 0}  ·  🏆 ${best}`;

    this.boardEl.innerHTML = ranked.slice(0, 5).map((s, i) => {
      const crown = s.id === king ? '👑 ' : '';
      const cls = s.id === playerId ? 'you' : '';
      return `<div class="${cls}">${i + 1}. ${crown}${s.id === playerId ? 'You' : s.name} — ${scoreOf(s)}</div>`;
    }).join('');

    // King flash when the player newly takes the crown
    const isKing = king === playerId;
    if (isKing && !this.wasKing) this.flashKing();
    this.wasKing = isKing;

    this.drawMinimap(state, playerId);
  }

  private flashKing(): void {
    const el = document.createElement('div');
    el.className = 'king-flash';
    el.textContent = "You're the King! 👑";
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  private drawMinimap(state: GameState, playerId: string): void {
    const { width, height } = this.minimap;
    const ctx = this.mmCtx;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    const scale = (Math.min(width, height) / 2 - 2) / state.world.radius;
    for (const s of state.snakes) {
      if (!s.alive) continue;
      const x = width / 2 + s.segments[0].x * scale;
      const y = height / 2 + s.segments[0].y * scale;
      ctx.beginPath();
      ctx.arc(x, y, s.id === playerId ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = s.id === playerId ? '#ff2bd6' : '#4dabff';
      ctx.fill();
    }
  }

  /** Allow main.ts to wire the boost button into Controls via pointer events. */
  get boostButton(): HTMLElement { return this.root.querySelector('#boost')!; }

  /** The mute toggle button; main.ts wires it to the AudioManager. */
  get muteButton(): HTMLElement { return this.root.querySelector('#mute')!; }

  /** Update the mute button icon to match audio state. */
  reflectMute(muted: boolean): void {
    this.muteButton.textContent = muted ? '🔇' : '🔊';
  }

  show(): void { this.root.classList.remove('hidden'); }
  hide(): void { this.root.classList.add('hidden'); }
}
```

> NOTE: The boost button is styled for thumb reach but the actual boost input is handled by `Controls` (right-half touch + spacebar). The button is a visual affordance; `main.ts` may also forward its pointer events to set boost, but that is optional polish.

- [ ] **Step 3: Implement `src/ui/screens.ts`**

```ts
import { SKINS } from '../skins/skins';
import { DIFFICULTY_ORDER, type Difficulty } from '../config/difficulty';

export interface StartChoices {
  difficulty: Difficulty;
  skinId: string;
  mouseControl: boolean; // desktop testing: steer with mouse, click to boost
}

/** Renders the start screen and resolves when the player taps Play. */
export function showStartScreen(
  mount: HTMLElement,
  initial: StartChoices,
  best: number,
): Promise<StartChoices> {
  return new Promise((resolve) => {
    let difficulty = initial.difficulty;
    let skinId = initial.skinId;
    let mouseControl = initial.mouseControl;

    mount.innerHTML = `
      <div class="screen">
        <h1>Snake!</h1>
        <div>🏆 Best: ${best}</div>
        <div>
          <div class="label">Difficulty</div>
          <div class="diff-row" id="diffs">
            ${DIFFICULTY_ORDER.map((d) => `<div class="chip" data-diff="${d}">${d}</div>`).join('')}
          </div>
        </div>
        <div>
          <div class="label">Pick your snake</div>
          <div class="skin-row" id="skins">
            ${SKINS.map((s) => `<div class="skin-swatch" data-skin="${s.id}" style="background:${s.body}" title="${s.name}"></div>`).join('')}
          </div>
        </div>
        <label class="mouse-toggle">
          <input type="checkbox" id="mouse" ${mouseControl ? 'checked' : ''} />
          Mouse control (desktop testing)
        </label>
        <button class="btn" id="play">Play</button>
      </div>`;

    const syncSelected = () => {
      mount.querySelectorAll('[data-diff]').forEach((el) =>
        el.classList.toggle('selected', el.getAttribute('data-diff') === difficulty));
      mount.querySelectorAll('[data-skin]').forEach((el) =>
        el.classList.toggle('selected', el.getAttribute('data-skin') === skinId));
    };
    syncSelected();

    mount.querySelector('#diffs')!.addEventListener('click', (e) => {
      const d = (e.target as HTMLElement).getAttribute('data-diff');
      if (d) { difficulty = d as Difficulty; syncSelected(); }
    });
    mount.querySelector('#skins')!.addEventListener('click', (e) => {
      const s = (e.target as HTMLElement).getAttribute('data-skin');
      if (s) { skinId = s; syncSelected(); }
    });
    mount.querySelector('#mouse')!.addEventListener('change', (e) => {
      mouseControl = (e.target as HTMLInputElement).checked;
    });
    mount.querySelector('#play')!.addEventListener('click', () => {
      mount.innerHTML = '';
      resolve({ difficulty, skinId, mouseControl });
    });
  });
}

/** Renders game-over and resolves with the player's next action. */
export function showGameOver(
  mount: HTMLElement,
  score: number,
  best: number,
): Promise<'again' | 'change'> {
  return new Promise((resolve) => {
    mount.innerHTML = `
      <div class="screen">
        <h1>Game Over</h1>
        <div style="font-size:24px">Length: <b>${score}</b></div>
        <div>🏆 Best: ${best}</div>
        <button class="btn" id="again">Play Again</button>
        <button class="btn secondary" id="change">Change Snake</button>
      </div>`;
    mount.querySelector('#again')!.addEventListener('click', () => { mount.innerHTML = ''; resolve('again'); });
    mount.querySelector('#change')!.addEventListener('click', () => { mount.innerHTML = ''; resolve('change'); });
  });
}
```

- [ ] **Step 4: Type-check, then commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

```bash
git add src/ui/ src/style.css
git commit -m "feat: add HUD and start/game-over screens"
```

---

## Task 16: Audio — snake.io-style sound effects & music

**Files:**
- Create: `src/audio/audio.ts`
- Test: `src/audio/audio.test.ts`

All sounds are **original, royalty-free** tones synthesized with the Web Audio API — none
of snake.io's copyrighted audio is used. The `AudioContext` is created lazily on the first
user gesture (mobile autoplay rules). The unit test only covers mute-state logic (no audio
hardware needed); the actual sounds are verified by ear in Task 17.

- [ ] **Step 1: Write the failing test**

```ts
// src/audio/audio.test.ts
import { describe, it, expect } from 'vitest';
import { AudioManager } from './audio';

describe('AudioManager mute state', () => {
  it('uses the provided initial mute state', () => {
    expect(new AudioManager(true).isMuted).toBe(true);
    expect(new AudioManager(false).isMuted).toBe(false);
  });

  it('toggles mute and returns the new state', () => {
    const a = new AudioManager(false);
    expect(a.toggleMute()).toBe(true);
    expect(a.isMuted).toBe(true);
    expect(a.toggleMute()).toBe(false);
    expect(a.isMuted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/audio/audio.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/audio/audio.ts`**

```ts
/**
 * Original snake.io-style audio via the Web Audio API. No third-party or copyrighted
 * assets — every sound is synthesized. The context is created lazily from a user gesture.
 * NOTE: callers must invoke resume() from within a user gesture before sound will play.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;

  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;

  private boosting = false;
  private boostOsc: OscillatorNode | null = null;

  // An original, cheerful 8-step loop (note frequencies in Hz).
  private readonly melody = [523, 659, 784, 659, 587, 698, 587, 494];
  private readonly stepDur = 0.18;

  constructor(muted = false) {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Create/resume the audio context. Safe to call repeatedly; call it from a tap/click. */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  playEat(): void {
    this.blip(880, 0.08, 'square', 0.22);
  }

  playDie(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playKing(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      window.setTimeout(() => this.blip(f, 0.16, 'triangle', 0.3), i * 90);
    });
  }

  /** Start/stop a low boost rumble while the player is boosting. */
  setBoosting(on: boolean): void {
    if (on === this.boosting) return;
    this.boosting = on;
    if (!this.ctx || !this.master) return;
    if (on) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 220;
      g.gain.value = 0.1;
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      this.boostOsc = osc;
    } else if (this.boostOsc) {
      this.boostOsc.stop();
      this.boostOsc.disconnect();
      this.boostOsc = null;
    }
  }

  startMusic(): void {
    if (!this.ctx || !this.master || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime;
    this.noteIndex = 0;
    const schedule = () => {
      if (!this.ctx || !this.master) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
        const f = this.melody[this.noteIndex % this.melody.length];
        const t = this.nextNoteTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + this.stepDur * 0.9);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + this.stepDur);
        this.nextNoteTime += this.stepDur;
        this.noteIndex++;
      }
      this.musicTimer = window.setTimeout(schedule, 60);
    };
    schedule();
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/audio/audio.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/audio/
git commit -m "feat: add Web Audio sound effects and looping music with mute"
```

---

## Task 17: Wire it together — playable game

**Files:**
- Rewrite: `src/main.ts`

This replaces the scaffold with the full app: start screen → game loop (fixed-timestep simulation + render + HUD) → game over → repeat, with audio wired to game events.

- [ ] **Step 1: Rewrite `src/main.ts`**

```ts
import './style.css';
import { createGame, update, PLAYER_ID } from './game/simulation';
import { DIFFICULTIES, type Difficulty } from './config/difficulty';
import { Controls } from './input/controls';
import { makeCamera } from './render/camera';
import { render } from './render/renderer';
import { Hud } from './ui/hud';
import { showStartScreen, showGameOver, type StartChoices } from './ui/screens';
import { scoreOf, kingId } from './game/leaderboard';
import { AudioManager } from './audio/audio';
import {
  getBestScore, setBestScore, getSkin, setSkin, getDifficulty, setDifficulty,
  getMuted, setMuted, getMouseControl, setMouseControl,
} from './persistence/storage';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hudMount = document.getElementById('hud') as HTMLElement;
const screenMount = document.getElementById('screens') as HTMLElement;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const controls = new Controls(canvas);
const hud = new Hud(hudMount);
hud.hide();

const audio = new AudioManager(getMuted());
hud.reflectMute(audio.isMuted);
hud.muteButton.addEventListener('click', () => {
  const muted = audio.toggleMute();
  setMuted(muted);
  hud.reflectMute(muted);
});

const rng = () => Math.random();
const FIXED_DT = 1 / 60;

function gameLoopOnce(difficulty: Difficulty, skinId: string): Promise<number> {
  const settings = DIFFICULTIES[difficulty];
  const state = createGame(difficulty, skinId, rng);
  const player = state.snakes.find((s) => s.id === PLAYER_ID)!;
  const best = getBestScore();
  hud.show();
  audio.startMusic();

  let prevScore = scoreOf(player);
  let wasKing = false;

  return new Promise((resolve) => {
    let last = performance.now();
    let acc = 0;
    let raf = 0;

    const frame = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      const input = controls.read();
      while (acc >= FIXED_DT) {
        update(state, FIXED_DT, input, settings, rng);
        acc -= FIXED_DT;
      }

      // audio reactions to game events
      const score = scoreOf(player);
      if (score > prevScore) audio.playEat();
      prevScore = score;
      audio.setBoosting(player.alive && player.boosting);
      const isKing = kingId(state.snakes) === PLAYER_ID;
      if (isKing && !wasKing) audio.playKing();
      wasKing = isKing;

      const w = window.innerWidth, h = window.innerHeight;
      const cam = makeCamera(player.segments[0], w, h, 1);
      render(ctx, state, cam);
      hud.update(state, PLAYER_ID, Math.max(best, score), cam);

      if (!player.alive) {
        cancelAnimationFrame(raf);
        audio.setBoosting(false);
        audio.stopMusic();
        audio.playDie();
        hud.hide();
        resolve(score);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

async function main() {
  let choices: StartChoices = {
    difficulty: getDifficulty(),
    skinId: getSkin(),
    mouseControl: getMouseControl(),
  };
  let goStraightToPlay = false;

  while (true) {
    if (!goStraightToPlay) {
      choices = await showStartScreen(screenMount, choices, getBestScore());
      setDifficulty(choices.difficulty);
      setSkin(choices.skinId);
      setMouseControl(choices.mouseControl);
    }
    // The Play / Play-Again tap is a user gesture: safe to (re)start audio here.
    audio.resume();
    controls.setMouseMode(choices.mouseControl);
    const score = await gameLoopOnce(choices.difficulty, choices.skinId);
    setBestScore(score);
    const action = await showGameOver(screenMount, score, getBestScore());
    goStraightToPlay = action === 'again';
  }
}

main();
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the game and verify the happy path**

Run: `pnpm dev`, open the printed URL in a desktop browser.
On the start screen tick **Mouse control (desktop testing)**, then verify by playing
(mouse to steer, click to boost; arrow keys/WASD + space also work):
- Start screen shows title, difficulty chips, skin swatches, and the mouse-control toggle; selecting/checking them updates the UI.
- Clicking Play starts the game and music begins; the snake steers toward the mouse pointer; the camera follows the snake.
- Eating pellets grows the snake longer *and* visibly fatter, and plays an eat blip.
- Holding a mouse-click boosts: you speed up, shrink, drop pellets, and a boost rumble plays.
- The leaderboard updates; reaching #1 shows the crown on your snake + "You're the King!" flash + a fanfare.
- The 🔊 button mutes/unmutes all audio and its icon updates.

- [ ] **Step 4: Verify failure paths**

- Steer into a bot's body → you die (death sound plays, music stops) → game-over screen shows your length and best.
- Steer into the border ring → you die on **every** difficulty (Easy included).
- "Play Again" restarts immediately with the same snake; "Change Snake" returns to the start screen (the mouse toggle stays remembered).

- [ ] **Step 5: Run full automated suite**

Run: `pnpm test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire screens, loop, simulation, render into a playable game"
```

---

## Task 18: PWA — installable, offline, full-screen

**Files:**
- Create: `public/manifest.webmanifest`, `tools/make-icons.html`
- Create (generated): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`

- [ ] **Step 1: Create `public/manifest.webmanifest`**

```json
{
  "name": "Snake!",
  "short_name": "Snake",
  "description": "A friendly snake game for kids.",
  "start_url": "./",
  "scope": "./",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#ffd27a",
  "theme_color": "#ffe3a3",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Create `tools/make-icons.html`** (a one-time generator; no build deps)

```html
<!doctype html>
<meta charset="utf-8" />
<body style="font-family:system-ui;padding:20px">
  <h3>Snake icon generator</h3>
  <p>Click each button to download the PNG, then move the files into <code>public/icons/</code>.</p>
  <canvas id="c" width="512" height="512"></canvas>
  <div>
    <button onclick="dl(192,'icon-192.png')">icon-192.png</button>
    <button onclick="dl(512,'icon-512.png')">icon-512.png</button>
    <button onclick="dl(180,'apple-touch-icon.png')">apple-touch-icon.png</button>
  </div>
  <script>
    function draw(size) {
      const c = document.getElementById('c');
      c.width = c.height = size;
      const x = c.getContext('2d');
      // background
      x.fillStyle = '#ffe3a3'; x.fillRect(0, 0, size, size);
      // a coiled snake
      const cx = size / 2, cy = size / 2, r = size * 0.07;
      x.lineCap = 'round';
      x.strokeStyle = '#ff7eb3'; x.lineWidth = r * 2;
      x.beginPath();
      for (let t = 0; t < 6.3; t += 0.05) {
        const rad = size * 0.32 * (1 - t / 8);
        const px = cx + Math.cos(t) * rad, py = cy + Math.sin(t) * rad;
        if (t === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
      // head
      const hx = cx + Math.cos(0) * size * 0.32, hy = cy + Math.sin(0) * size * 0.32;
      x.fillStyle = '#ff7eb3'; x.beginPath(); x.arc(hx, hy, r * 1.4, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(hx + r * 0.4, hy - r * 0.4, r * 0.5, 0, 7); x.fill();
      x.fillStyle = '#222'; x.beginPath(); x.arc(hx + r * 0.6, hy - r * 0.4, r * 0.25, 0, 7); x.fill();
      return c;
    }
    function dl(size, name) {
      const c = draw(size);
      const a = document.createElement('a');
      a.download = name; a.href = c.toDataURL('image/png'); a.click();
    }
    draw(512);
  </script>
</body>
```

- [ ] **Step 3: Generate the icons**

Run: `pnpm dev`, open `http://localhost:5173/tools/make-icons.html` (adjust port to what Vite prints).
Click all three buttons; move the downloaded files into `public/icons/`.
Verify: `ls public/icons/` shows `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.

- [ ] **Step 4: Build the production PWA**

Run: `pnpm build`
Expected: `dist/` is produced with `sw.js`/workbox files, `manifest.webmanifest`, and hashed assets. No TypeScript errors.

- [ ] **Step 5: Preview the production build and confirm installability**

Run: `pnpm preview` (it prints a `--host` URL reachable on your network).
In Chrome desktop DevTools → Application → Manifest: confirm the manifest loads, icons resolve, and a service worker is registered. Toggle "Offline" in the Network tab and reload — the game still loads.

- [ ] **Step 6: Commit**

```bash
git add public/ tools/
git commit -m "feat: add PWA manifest, icons, and offline service worker"
```

---

## Task 19: Install on the iPad & final verification

**Files:** none (deployment + acceptance).

- [ ] **Step 1: Serve the build on your home network**

Run: `pnpm build && pnpm preview`
Note the LAN URL Vite prints (e.g. `http://192.168.x.x:4173`). Your Mac and the iPad must be on the same wifi.
(Alternative for permanence: copy `dist/` to any free static host — no backend is needed.)

- [ ] **Step 2: Install to the iPad home screen**

On the iPad, open the LAN URL in **Safari** → Share → **Add to Home Screen**. Launch from the new icon: it opens full-screen with no Safari chrome.

- [ ] **Step 3: Acceptance checklist (play on the iPad)**

- Thumbstick (left half) steers smoothly; small-hand friendly dead-zone works.
- Boost (right half) speeds up and sheds length.
- Snake grows longer and fatter; a big snake dominates the screen.
- Leaderboard + crown behave; becoming King shows the flash + fanfare.
- Audio plays (eat/boost/die/King + music); the 🔊 mute toggle works and is remembered.
- Easy has few, gentle bots; Hard has many cunning, aggressive bots. The border is deadly on every difficulty.
- Airplane mode: the game still launches and plays (offline confirmed).

- [ ] **Step 4: Final full-suite run**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: tests pass, no type errors, build succeeds.

- [ ] **Step 5: Commit any final tweaks**

```bash
git add -A
git commit -m "chore: final verification pass"
```

---

## Self-review notes (for the implementer)

- **Determinism in tests:** simulation/bot tests inject `rng`. `main.ts` uses `Math.random` at runtime, which is fine.
- **`headHitsSnake` self-collision:** only points past `SELF_SKIP` count, so a snake doesn't die on its own neck but can die on its own coiled body — matching snake.io.
- **Rules vs. difficulty:** all *game rules* (speed `BASE_SPEED`, arena `WORLD_RADIUS`, deadly border, growth, collisions) live in `src/game/constants.ts` and are identical on every difficulty. `src/config/difficulty.ts` holds *only* bot-AI knobs (`botCount`, `aggression`, `cunning`). Keep that separation: never add a rule to `DifficultySettings`.
- **Border:** always deadly — there is no per-difficulty border behavior.
- **Bot boost:** boost is symmetric — bots boost via `decideBoost` (chase a smaller, nearby player or dash for close food), scaled by aggression/cunning, while keeping a mass buffer above `MIN_BOOST_MASS`. The boost mass-shed/food-drop loop in `update()` already applies to any boosting snake.
- **Audio:** all sounds are synthesized originals (no snake.io assets). The `AudioContext` only starts from the Play tap (`audio.resume()`), satisfying mobile autoplay rules.
- **Mouse mode:** desktop-testing only, gated by the start-screen toggle; touch remains primary and is unaffected.
- **Balance:** expect to tweak `BASE_SPEED`, `GIRTH_FACTOR`, `FOOD_DENSITY` (constants) and `aggression`/`cunning` (difficulty) after watching real play — the spec explicitly allows post-hoc tuning.
- **Known follow-ups (out of v1 scope):** score-milestone skin unlocks, additional modes.
