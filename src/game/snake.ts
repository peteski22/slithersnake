import { Vec2, vec, add, sub, scale, length, normalize, fromAngle } from '../math/vec2';
import type { Snake } from './types';
import {
  SEGMENT_SPACING, START_SEGMENTS, BASE_RADIUS, GIRTH_FACTOR,
  MASS_PER_SEGMENT, START_MASS,
} from './constants';

export interface CreateSnakeParams {
  id: string;
  name: string;
  isPlayer: boolean;
  skinId: string;
  pos: Vec2;     // head position
  heading: number;
}

/** Segment radius (world units) for a given mass. */
export function radiusForMass(mass: number): number {
  return BASE_RADIUS + Math.sqrt(Math.max(0, mass)) * GIRTH_FACTOR;
}

/** How many body points a snake should have at a given mass. */
export function desiredSegments(mass: number): number {
  const extra = Math.floor((mass - START_MASS) / MASS_PER_SEGMENT);
  return Math.max(START_SEGMENTS, START_SEGMENTS + extra);
}

export function createSnake(p: CreateSnakeParams): Snake {
  const dir = fromAngle(p.heading);
  const segments: Vec2[] = [];
  for (let i = 0; i < START_SEGMENTS; i++) {
    segments.push(sub(p.pos, scale(dir, i * SEGMENT_SPACING)));
  }
  return {
    id: p.id,
    name: p.name,
    isPlayer: p.isPlayer,
    skinId: p.skinId,
    segments,
    heading: p.heading,
    mass: START_MASS,
    boosting: false,
    alive: true,
    boostDropTimer: 0,
  };
}

/** Advance the head by speed*dt along `heading`, then drag each body point to keep spacing. */
export function stepSnake(s: Snake, speed: number, dt: number): void {
  const dir = fromAngle(s.heading);
  s.segments[0] = add(s.segments[0], scale(dir, speed * dt));
  for (let i = 1; i < s.segments.length; i++) {
    const ahead = s.segments[i - 1];
    const cur = s.segments[i];
    const d = sub(ahead, cur);
    const dist = length(d);
    if (dist > SEGMENT_SPACING) {
      s.segments[i] = add(cur, scale(normalize(d), dist - SEGMENT_SPACING));
    }
  }
}

/** Reconcile body-point count with current mass (append at tail / trim from tail). */
export function applyGrowth(s: Snake): void {
  const want = desiredSegments(s.mass);
  while (s.segments.length < want) {
    const tail = s.segments[s.segments.length - 1];
    const prev = s.segments[s.segments.length - 2] ?? add(tail, vec(SEGMENT_SPACING, 0));
    // new point continues the tail direction
    const back = normalize(sub(tail, prev));
    s.segments.push(add(tail, scale(back, SEGMENT_SPACING)));
  }
  while (s.segments.length > want && s.segments.length > 2) {
    s.segments.pop();
  }
}

/** Convenience: current head position. */
export const head = (s: Snake): Vec2 => s.segments[0];

/** Current girth radius. */
export const snakeRadius = (s: Snake): number => radiusForMass(s.mass);
