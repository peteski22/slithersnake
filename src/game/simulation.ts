import { vec, rotateToward } from '../math/vec2';
import type { GameState, InputState, Snake } from './types';
import type { Difficulty, DifficultySettings } from '../config/difficulty';
import { DIFFICULTIES } from '../config/difficulty';
import { createSnake, stepSnake } from './snake';
import { tryEat, attractFood, burstFromSnake, replenishFood, randomWorldPoint } from './food';
import { headHitsSnake, headOutsideBorder } from './collision';
import { decideHeading, decideBoost } from './bots';
import {
  WORLD_WIDTH, WORLD_HEIGHT, BASE_SPEED, TURN_RATE, BOT_TURN_RATE, MIN_BOOST_MASS, BOOST_DRAIN,
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
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    snakes: [],
    food: [],
    nextFoodId: 1,
    tick: 0,
  };

  state.snakes.push(createSnake({
    id: PLAYER_ID, name: 'You', isPlayer: true, skinId: playerSkinId,
    pos: vec(0, 0), heading: rng() * Math.PI * 2,
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
        state.food.push({ id: state.nextFoodId++, pos: { ...tail }, value: FOOD_VALUE, big: false });
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
    if (!s.alive || s.spawnGraceTicks > 0) continue;
    if (headOutsideBorder(s, state.world)) {
      s.alive = false;
      burstFromSnake(state, s);
    }
  }
  for (const s of state.snakes) {
    if (!s.alive || s.spawnGraceTicks > 0) continue;
    for (const other of state.snakes) {
      if (other === s) continue; // no self-collision: a snake may cross its own body
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
