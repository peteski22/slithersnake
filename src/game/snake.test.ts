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
