// src/game/food.test.ts
import { describe, it, expect } from 'vitest';
import { vec } from '../math/vec2';
import { createSnake, stepSnake } from './snake';
import { makeFood, tryEat, burstFromSnake, targetFoodCount } from './food';
import type { GameState } from './types';
import { FOOD_VALUE } from './constants';

function blankState(): GameState {
  return { world: { width: 2000, height: 1500 }, snakes: [], food: [], nextFoodId: 1, tick: 0 };
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
    makeFood(st, vec(2, 0), 5, false); // very close to head
    const massBefore = s.mass;
    tryEat(st, s);
    expect(st.food.length).toBe(0);
    expect(s.mass).toBe(massBefore + 5);
  });

  it('does not eat food that is far away', () => {
    const st = blankState();
    const s = createSnake({ id: 'p', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    st.snakes.push(s);
    makeFood(st, vec(500, 0), 5, false);
    tryEat(st, s);
    expect(st.food.length).toBe(1);
  });

  it('bursts a dead snake into multiple glowing pellets', () => {
    const st = blankState();
    const s = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    s.mass = 60;
    // snakes spawn collapsed; move straight so the body has length to drop pellets along
    for (let i = 0; i < 120; i++) stepSnake(s, 120, 1 / 60);
    const before = st.food.length;
    burstFromSnake(st, s);
    expect(st.food.length).toBeGreaterThan(before);
    expect(st.food.every((f) => f.big && f.color === '#4dabff')).toBe(true);
  });

  it('targetFoodCount scales with world size', () => {
    expect(targetFoodCount({ width: 2000, height: 2000 })).toBeGreaterThan(targetFoodCount({ width: 1000, height: 1000 }));
  });
});
