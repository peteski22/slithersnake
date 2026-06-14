// src/game/leaderboard.test.ts
import { describe, it, expect } from 'vitest';
import { vec } from '../math/vec2';
import { createSnake } from './snake';
import { scoreOf, ranking, kingId } from './leaderboard';
import type { Snake } from './types';

function snakeWithScore(id: string, score: number, alive = true): Snake {
  const s = createSnake({ id, name: id, isPlayer: id === 'you', skinId: 'pink', pos: vec(0, 0), heading: 0 });
  s.score = score;
  s.alive = alive;
  return s;
}

describe('leaderboard', () => {
  it('scoreOf returns the snake accumulated score (not mass)', () => {
    const s = snakeWithScore('a', 42);
    s.mass = 999; // mass must not influence score
    expect(scoreOf(s)).toBe(42);
  });

  it('ranks alive snakes by score descending', () => {
    const snakes = [snakeWithScore('a', 10), snakeWithScore('b', 50), snakeWithScore('c', 30)];
    expect(ranking(snakes).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('excludes dead snakes from the ranking', () => {
    const snakes = [snakeWithScore('a', 10), snakeWithScore('b', 99, false)];
    expect(ranking(snakes).map((s) => s.id)).toEqual(['a']);
  });

  it('king is the highest-scoring alive snake', () => {
    const snakes = [snakeWithScore('a', 10), snakeWithScore('b', 50), snakeWithScore('you', 30)];
    expect(kingId(snakes)).toBe('b');
  });

  it('king is null when no snakes are alive', () => {
    expect(kingId([snakeWithScore('a', 10, false)])).toBeNull();
  });
});
