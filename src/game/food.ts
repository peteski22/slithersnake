import { Vec2, vec, distance } from '../math/vec2';
import type { Food, GameState, Snake, World } from './types';
import { snakeRadius } from './snake';
import { getSkin } from '../skins/skins';
import {
  FOOD_RADIUS, FOOD_DENSITY, DEATH_FOOD_SPACING, DEATH_FOOD_VALUE,
  FOOD_MAGNET_RANGE, FOOD_MAGNET_SPEED,
} from './constants';

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
export function attractFood(state: GameState, s: Snake, dt: number): void {
  const headPos = s.segments[0];
  const range = snakeRadius(s) + FOOD_MAGNET_RANGE;
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

/** Desired ambient food count for a world (area * density). */
export function targetFoodCount(world: World): number {
  const area = world.width * world.height;
  return Math.round(area * FOOD_DENSITY);
}

/** A uniformly random point inside the rectangular world (keeps a margin off the walls). */
export function randomWorldPoint(world: World, rng: () => number): Vec2 {
  const m = 0.96; // margin so spawns aren't flush against the deadly border
  return vec((rng() - 0.5) * world.width * m, (rng() - 0.5) * world.height * m);
}

/** Top up ambient food toward the target count. */
export function replenishFood(state: GameState, rng: () => number): void {
  const target = targetFoodCount(state.world);
  const ambient = state.food.filter((f) => !f.big).length;
  for (let i = ambient; i < target; i++) {
    makeFood(state, randomWorldPoint(state.world, rng), 1, false);
  }
}
