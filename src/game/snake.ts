import { Vec2, add, scale, distance, fromAngle } from '../math/vec2';
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

/**
 * Continuous body length (world units) for a given mass; grows smoothly so a new section
 * drags out of the tail as the snake moves rather than popping in at full length.
 */
export function bodyLengthForMass(mass: number): number {
  const extra = Math.max(0, (mass - START_MASS) / MASS_PER_SEGMENT);
  return (START_SEGMENTS - 1 + extra) * SEGMENT_SPACING;
}

export function createSnake(p: CreateSnakeParams): Snake {
  // Start collapsed at the spawn point; the body "grows out" as the head lays down a path.
  const segments: Vec2[] = [];
  for (let i = 0; i < START_SEGMENTS; i++) segments.push({ ...p.pos });
  return {
    id: p.id,
    name: p.name,
    isPlayer: p.isPlayer,
    skinId: p.skinId,
    segments,
    path: [{ ...p.pos }],
    heading: p.heading,
    mass: START_MASS,
    boosting: false,
    alive: true,
    boostDropTimer: 0,
    spawnGraceTicks: p.isPlayer ? SPAWN_GRACE_TICKS : 0, // only the player gets spawn invulnerability
  };
}

/**
 * Place the body markers along the head's path; the body length comes from mass, so the
 * marker count grows smoothly and the tail drags out as the snake grows.
 * Because every marker advances along the real path each frame, the tail always keeps
 * moving — even when the head loops back on itself.
 */
function resampleBody(s: Snake): void {
  // Marker distances back from the head: full SEGMENT_SPACING steps plus a final partial
  // marker at the exact body length, so the tail drags out smoothly as the body grows.
  const targetArc = bodyLengthForMass(s.mass);
  const targets: number[] = [];
  for (let d = SEGMENT_SPACING; d < targetArc - 0.001; d += SEGMENT_SPACING) targets.push(d);
  targets.push(targetArc);

  const out: Vec2[] = [{ ...s.path[0] }]; // head
  let traveled = 0;
  let ti = 0;
  for (let i = 1; i < s.path.length && ti < targets.length; i++) {
    const a = s.path[i - 1];
    const b = s.path[i];
    const segLen = distance(a, b);
    while (ti < targets.length && traveled + segLen >= targets[ti]) {
      const t = segLen > 0 ? (targets[ti] - traveled) / segLen : 0;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      ti++;
    }
    traveled += segLen;
  }
  // Young/short path: remaining markers stay stacked at the path's end (the grow-out effect).
  const tail = s.path[s.path.length - 1];
  while (ti < targets.length) { out.push({ ...tail }); ti++; }
  s.segments = out;
}

/** Keep the path only as long as needed to position the whole body. */
function trimPath(s: Snake): void {
  const maxArc = bodyLengthForMass(s.mass) + SEGMENT_SPACING;
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
