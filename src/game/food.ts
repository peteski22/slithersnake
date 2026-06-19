import { Vec2, vec, distance } from '../math/vec2';
import type { Food, GameState, Snake, World } from './types';
import { snakeRadius } from './snake';
import { getSkin } from '../skins/skins';
import {
  FOOD_RADIUS, FOOD_DENSITY, FOOD_RESPAWN_RATE, DEATH_FOOD_SPACING, DEATH_FOOD_VALUE,
  FOOD_MAGNET_RANGE, FOOD_MAGNET_SPEED, POINTS_PELLET, POINTS_BIG_PELLET,
} from './constants';
import type { FoodModeSettings } from '../config/food-mode';

export function makeFood(
  state: GameState,
  pos: Vec2,
  value: number,
  big: boolean,
  color?: string,
): Food {
  const f: Food = { id: state.nextFoodId++, pos, value, big, color };
  state.food.push(f);
  return f;
}

/** Pull nearby food toward a snake's head so it looks magnetised/sucked in before eating. */
export function attractFood(state: GameState, s: Snake, dt: number, magnetRange = FOOD_MAGNET_RANGE): void {
  const headPos = s.segments[0];
  const range = snakeRadius(s) + magnetRange;
  const pull = FOOD_MAGNET_SPEED * dt;
  for (const f of state.food) {
    const d = distance(headPos, f.pos);
    if (d > 0 && d < range) {
      const t = Math.min(1, pull / d);
      f.pos = { x: f.pos.x + (headPos.x - f.pos.x) * t, y: f.pos.y + (headPos.y - f.pos.y) * t };
    }
  }
}

/** Eat any food whose center is within (head radius + food radius) of the snake's head. */
export function tryEat(state: GameState, s: Snake): void {
  const reach = snakeRadius(s) + FOOD_RADIUS;
  const headPos = s.segments[0];
  const remaining: Food[] = [];
  for (const f of state.food) {
    if (distance(headPos, f.pos) <= reach) {
      s.mass += f.value;
      if (f.owner === s.id) {
        // re-collecting your own boost trail: reclaim mass but score nothing (no circle-farming)
      } else if (f.big) {
        s.score += POINTS_BIG_PELLET; // score is separate from mass
        s.eatenBig++;
      } else {
        s.score += POINTS_PELLET;
        s.eatenPellets++;
      }
    } else {
      remaining.push(f);
    }
  }
  state.food = remaining;
}

/**
 * Drop glowing pellets along a dead snake's body, spaced by arc length and coloured to
 * match the snake so it's clear whose remains they are. Worth more than ambient pellets.
 */
export function burstFromSnake(state: GameState, s: Snake): void {
  const color = getSkin(s.skinId).body;
  makeFood(state, { ...s.segments[0] }, DEATH_FOOD_VALUE, true, color); // always leave at least the head
  let acc = 0;
  for (let i = 1; i < s.segments.length; i++) {
    acc += distance(s.segments[i - 1], s.segments[i]);
    if (acc >= DEATH_FOOD_SPACING) {
      acc = 0;
      makeFood(state, { ...s.segments[i] }, DEATH_FOOD_VALUE, true, color);
    }
  }
}

/** Desired ambient food count for a world (area * density), scaled by food mode. */
export function targetFoodCount(world: World, densityMultiplier = 1): number {
  const area = world.width * world.height;
  return Math.round(area * FOOD_DENSITY * densityMultiplier);
}

/** A uniformly random point inside the rectangular world (keeps a margin off the walls). */
export function randomWorldPoint(world: World, rng: () => number): Vec2 {
  const m = 0.96; // margin so spawns aren't flush against the deadly border
  return vec((rng() - 0.5) * world.width * m, (rng() - 0.5) * world.height * m);
}

/** Fill the world to the target food count in one shot (used at game creation). */
export function fillFood(state: GameState, rng: () => number, foodSettings?: FoodModeSettings): void {
  const multiplier = foodSettings?.densityMultiplier ?? 1;
  const target = targetFoodCount(state.world, multiplier);
  const ambient = state.food.filter((f) => !f.big).length;
  for (let i = ambient; i < target; i++) {
    makeFood(state, randomWorldPoint(state.world, rng), 1, false);
  }
}

/** Top up ambient food toward the target count, capped to a gradual respawn rate. */
export function replenishFood(state: GameState, rng: () => number, foodSettings?: FoodModeSettings): void {
  const multiplier = foodSettings?.densityMultiplier ?? 1;
  const rate = foodSettings?.respawnRate ?? FOOD_RESPAWN_RATE;
  const target = targetFoodCount(state.world, multiplier);
  const ambient = state.food.filter((f) => !f.big).length;
  const toSpawn = Math.min(target - ambient, rate);
  for (let i = 0; i < toSpawn; i++) {
    makeFood(state, randomWorldPoint(state.world, rng), 1, false);
  }
}
