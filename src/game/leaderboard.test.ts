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
