// src/game/snake.test.ts
import { describe, it, expect } from 'vitest';
import { vec, distance } from '../math/vec2';
import { createSnake, radiusForMass, desiredSegments, stepSnake, segmentSpacing } from './snake';
import { START_MASS, START_SEGMENTS } from './constants';

describe('snake model', () => {
  it('creates a snake collapsed at the spawn point with START_SEGMENTS points', () => {
    const s = createSnake({ id: 'p', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(5, 7), heading: 0 });
    expect(s.segments.length).toBe(START_SEGMENTS);
    expect(s.mass).toBe(START_MASS);
    // all sections start stacked at the spawn point; the body extends as the head moves
    expect(s.segments.every((seg) => seg.x === 5 && seg.y === 7)).toBe(true);
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
    // spacing between consecutive points stays ~one (girth-scaled) section gap
    const gap = distance(s.segments[0], s.segments[1]);
    expect(gap).toBeCloseTo(segmentSpacing(START_MASS), 0);
  });

  it('grows the body length (more sections) as mass increases', () => {
    const small = createSnake({ id: 'a', name: 'A', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    const big = createSnake({ id: 'b', name: 'B', isPlayer: true, skinId: 'pink', pos: vec(0, 0), heading: 0 });
    big.mass = START_MASS + 80;
    // move both straight so their bodies extend fully along the path
    for (let i = 0; i < 200; i++) {
      stepSnake(small, 120, 1 / 60);
      stepSnake(big, 120, 1 / 60);
    }
    expect(big.segments.length).toBeGreaterThan(small.segments.length);
  });
});
