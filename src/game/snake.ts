import { Vec2, add, sub, scale, distance, fromAngle } from '../math/vec2';
import type { Snake } from './types';
import {
  SEGMENT_SPACING, START_SEGMENTS, BASE_RADIUS, GIRTH_FACTOR,
  MASS_PER_SEGMENT, START_MASS, SPAWN_GRACE_TICKS,
} from './constants';

export interface CreateSnakeParams {
  id: string;
  name: string;
  isPlayer: boolean;
  skinId: string;
  pos: Vec2;          // head position
  heading: number;
  mass?: number;      // starting mass (defaults to START_MASS)
  grown?: boolean;    // if true, spawn already full-length (an enemy "already in the arena")
}

/** Segment radius (world units) for a given mass. */
export function radiusForMass(mass: number): number {
  return BASE_RADIUS + Math.sqrt(Math.max(0, mass)) * GIRTH_FACTOR;
}

/** How many body sections a snake should have at a given mass (whole sections). */
export function desiredSegments(mass: number): number {
  const extra = Math.floor((mass - START_MASS) / MASS_PER_SEGMENT);
  return Math.max(START_SEGMENTS, START_SEGMENTS + extra);
}

export function createSnake(p: CreateSnakeParams): Snake {
  const mass = p.mass ?? START_MASS;
  const segments: Vec2[] = [];
  let path: Vec2[];
  if (p.grown) {
    // Already in the arena: lay the body out full-length behind the head.
    const dir = fromAngle(p.heading);
    const count = desiredSegments(mass);
    for (let i = 0; i < count; i++) segments.push(sub(p.pos, scale(dir, i * SEGMENT_SPACING)));
    path = [];
    for (let i = 0; i <= count + 1; i++) path.push(sub(p.pos, scale(dir, i * SEGMENT_SPACING)));
  } else {
    // Collapsed at the spawn point; grows out as the head moves so it never "pops in" at
    // full length in front of others. Only the player is invulnerable while it grows.
    for (let i = 0; i < START_SEGMENTS; i++) segments.push({ ...p.pos });
    path = [{ ...p.pos }];
  }
  return {
    id: p.id,
    name: p.name,
    isPlayer: p.isPlayer,
    skinId: p.skinId,
    segments,
    path,
    heading: p.heading,
    mass,
    boosting: false,
    alive: true,
    boostDropTimer: 0,
    spawnGraceTicks: p.isPlayer ? SPAWN_GRACE_TICKS : 0, // only the player gets spawn invulnerability
  };
}

/**
 * Place the body sections along the head's path at fixed SEGMENT_SPACING intervals; the
 * section count comes from mass (whole sections). Because every section advances along the
 * real path each frame, the tail always keeps moving — even when the head loops back.
 */
function resampleBody(s: Snake): void {
  const want = desiredSegments(s.mass); // whole sections; a new section is added at once
  const out: Vec2[] = [{ ...s.path[0] }]; // head
  let targetDist = SEGMENT_SPACING;
  let traveled = 0;
  for (let i = 1; i < s.path.length && out.length < want; i++) {
    const a = s.path[i - 1];
    const b = s.path[i];
    const segLen = distance(a, b);
    while (out.length < want && traveled + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - traveled) / segLen : 0;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      targetDist += SEGMENT_SPACING;
    }
    traveled += segLen;
  }
  // Young/short path (player growing out): remaining sections stay stacked at the path's end.
  const tail = s.path[s.path.length - 1];
  while (out.length < want) out.push({ ...tail });
  s.segments = out;
}

/** Keep the path only as long as needed to position the whole body. */
function trimPath(s: Snake): void {
  const maxArc = desiredSegments(s.mass) * SEGMENT_SPACING + SEGMENT_SPACING;
  let arc = 0;
  for (let i = 1; i < s.path.length; i++) {
    arc += distance(s.path[i - 1], s.path[i]);
    if (arc >= maxArc) {
      s.path.length = i + 1;
      return;
    }
  }
}

/** Advance the head by speed*dt along `heading`, extend the path, and resample the body. */
export function stepSnake(s: Snake, speed: number, dt: number): void {
  const dir = fromAngle(s.heading);
  s.path.unshift(add(s.path[0], scale(dir, speed * dt)));
  resampleBody(s);
  trimPath(s);
}

/** Convenience: current head position. */
export const head = (s: Snake): Vec2 => s.segments[0];

/** Current girth radius. */
export const snakeRadius = (s: Snake): number => radiusForMass(s.mass);
