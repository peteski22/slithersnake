import { Vec2, vec, distance } from '../math/vec2';
import type { Food, GameState, Snake, World } from './types';
import { snakeRadius } from './snake';
import {
  FOOD_RADIUS, FOOD_DENSITY, DEATH_FOOD_SPACING, DEATH_FOOD_VALUE,
} from './constants';

export function makeFood(state: GameState, pos: Vec2, value: number, big: boolean): Food {
  const f: Food = { id: state.nextFoodId++, pos, value, big };
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
      state.food.push(makeFood(state, { ...s.segments[i] }, DEATH_FOOD_VALUE, true));
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
    state.food.push(makeFood(state, randomWorldPoint(state.world, rng), 1, false));
  }
}
