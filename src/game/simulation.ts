import { vec, distance, rotateToward, type Vec2 } from '../math/vec2';
import type { GameState, InputState, Snake, World } from './types';
import type { Difficulty, DifficultySettings } from '../config/difficulty';
import { DIFFICULTIES } from '../config/difficulty';
import { createSnake, stepSnake, snakeRadius } from './snake';
import { tryEat, attractFood, burstFromSnake, replenishFood, randomWorldPoint } from './food';
import { headHitsSnake, headOutsideBorder } from './collision';
import { decideHeading, decideBoost } from './bots';
import { getSkin } from '../skins/skins';
import {
  WORLD_WIDTH, WORLD_HEIGHT, BASE_SPEED, TURN_RATE, BOT_TURN_RATE, MIN_BOOST_MASS, BOOST_DRAIN,
  BOOST_MULTIPLIER, BOOST_DROP_INTERVAL, FOOD_VALUE, START_MASS, MIN_SPAWN_DISTANCE, POINTS_KILL,
} from './constants';

export const PLAYER_ID = 'player';

/**
 * Pick a spawn point at least MIN_SPAWN_DISTANCE from every living snake's head, so a new
 * snake never appears on top of or right in front of another. Falls back to the farthest
 * candidate found if no fully-clear point turns up within a few tries.
 */
function safeSpawnPoint(state: GameState, rng: () => number): Vec2 {
  let best = randomWorldPoint(state.world, rng);
  let bestMin = -1;
  for (let attempt = 0; attempt < 24; attempt++) {
    const p = randomWorldPoint(state.world, rng);
    let minD = Infinity;
    for (const s of state.snakes) {
      if (!s.alive) continue;
      const d = distance(p, s.segments[0]);
      if (d < minD) minD = d;
    }
    if (minD >= MIN_SPAWN_DISTANCE) return p;
    if (minD > bestMin) { bestMin = minD; best = p; }
  }
  return best;
}

const BOT_NAMES = [
  'Rex', 'Biscuit', 'Sparkle', 'Zoom', 'Noodle', 'Fang', 'Pebble', 'Sunny',
  'Dash', 'Mango', 'Boots', 'Cosmo', 'Pixel', 'Ziggy', 'Coco', 'Tank',
];
const SKIN_IDS = ['pink', 'blue', 'green', 'dragon', 'dog', 'rainbow', 'sun', 'mint'];

export function createGame(
  difficulty: Difficulty,
  playerSkinId: string,
  rng: () => number,
  playerName = 'You',
): GameState {
  const settings = DIFFICULTIES[difficulty];
  const state: GameState = {
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    snakes: [],
    food: [],
    nextFoodId: 1,
    tick: 0,
  };

  state.snakes.push(createSnake({
    id: PLAYER_ID, name: playerName, isPlayer: true, skinId: playerSkinId,
    pos: vec(0, 0), heading: rng() * Math.PI * 2,
  }));

  for (let i = 0; i < settings.botCount; i++) {
    const pos = safeSpawnPoint(state, rng);
    const bot = createSnake({
      id: `bot${i}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isPlayer: false,
      skinId: SKIN_IDS[i % SKIN_IDS.length],
      pos,
      heading: rng() * Math.PI * 2,
      // Enemies are already in the arena at varied sizes (biased small) to bootstrap play.
      mass: START_MASS + Math.floor(rng() * rng() * 80),
      grown: true,
    });
    bot.score = Math.floor(bot.mass - START_MASS); // seed leaderboard variety from starting size
    state.snakes.push(bot);
  }

  replenishFood(state, rng);
  return state;
}

/**
 * Keep an invulnerable snake's head inside the arena so it slides along the wall instead of
 * leaving. Clamps the authoritative path head and the rendered head to the inner edge.
 */
function clampHeadInside(s: Snake, world: World): void {
  const r = snakeRadius(s);
  const maxX = world.width / 2 - r;
  const maxY = world.height / 2 - r;
  const h = s.path[0];
  const cx = Math.max(-maxX, Math.min(maxX, h.x));
  const cy = Math.max(-maxY, Math.min(maxY, h.y));
  if (cx !== h.x || cy !== h.y) {
    s.path[0] = { x: cx, y: cy };
    s.segments[0] = { x: cx, y: cy };
  }
}

/**
 * Drop a fresh (small) player into the EXISTING world — bots and food are untouched, so
 * enemies keep their sizes. Used for "continue/respawn" after death (vs. a full restart).
 */
export function respawnPlayer(
  state: GameState,
  rng: () => number,
  name = 'You',
  skinId?: string,
  mass?: number,   // undefined => START_MASS (respawn); pass old mass for Revive (grows back out)
  score = 0,       // 0 for respawn; restore the old score for Revive
): void {
  const idx = state.snakes.findIndex((s) => s.id === PLAYER_ID);
  const old = idx >= 0 ? state.snakes[idx] : undefined;
  const fresh = createSnake({
    id: PLAYER_ID, name, isPlayer: true,
    skinId: skinId ?? old?.skinId ?? 'pink',
    pos: safeSpawnPoint(state, rng), heading: rng() * Math.PI * 2,
    mass, // collapsed grow-out: a revived snake emerges from a point back to its old size
  });
  fresh.score = score;
  if (idx >= 0) state.snakes[idx] = fresh;
  else state.snakes.push(fresh);
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

  // Spawn invulnerability counts down while the body grows out from the spawn point.
  for (const s of state.snakes) {
    if (s.alive && s.spawnGraceTicks > 0) s.spawnGraceTicks--;
  }

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
        state.food.push({ id: state.nextFoodId++, pos: { ...tail }, value: FOOD_VALUE, big: false, color: getSkin(s.skinId).body });
      }
    }
  }

  // 3) Eating (food is magnetised toward the head first, then eaten). Body length is
  // derived continuously from mass in stepSnake, so no explicit growth step is needed.
  for (const s of state.snakes) {
    if (s.alive) {
      attractFood(state, s, dt);
      tryEat(state, s);
    }
  }

  // 4) Collisions. The border is ALWAYS deadly (every difficulty); then body hits.
  // Snakes inside their spawn-grace window are invulnerable (skip them as victims).
  for (const s of state.snakes) {
    if (!s.alive) continue;
    if (s.spawnGraceTicks > 0) {
      clampHeadInside(s, state.world); // invulnerable: can't leave — slide along the wall
      continue;
    }
    if (headOutsideBorder(s, state.world)) {
      s.alive = false;
      burstFromSnake(state, s);
    }
  }
  for (const s of state.snakes) {
    if (!s.alive) continue;
    for (const other of state.snakes) {
      if (other === s || !other.alive) continue; // no self-collision
      if (!headHitsSnake(s, other)) continue;
      if (s.spawnGraceTicks > 0) {
        // invulnerable: plow through — kill the snake you ram into and keep going
        other.alive = false;
        s.score += POINTS_KILL;
        burstFromSnake(state, other);
        continue;
      }
      // normal: running your head into another's body kills you; they score the kill
      s.alive = false;
      other.score += POINTS_KILL;
      burstFromSnake(state, s);
      break;
    }
  }

  // 5) Respawn dead bots so the world stays populated (the player stays dead).
  for (let i = 0; i < state.snakes.length; i++) {
    const s = state.snakes[i];
    if (!s.alive && !s.isPlayer) {
      state.snakes[i] = createSnake({
        id: s.id, name: s.name, isPlayer: false, skinId: s.skinId,
        pos: safeSpawnPoint(state, rng), heading: rng() * Math.PI * 2,
      });
    }
  }

  // 6) Keep ambient food topped up.
  replenishFood(state, rng);
}
