import { distance, sub, dot, fromAngle } from '../math/vec2';
import type { Snake, World } from './types';
import { snakeRadius } from './snake';
import { SEGMENT_SPACING } from './constants';

/** Number of leading body points a snake cannot collide with on itself (its own neck). */
const SELF_SKIP = 4;

/**
 * cos of the head's forward half-angle. Only body points within this cone ahead of the
 * head are deadly, so a snake can swerve in front of / cut off others without dying from
 * side or rear contact. ~0.25 ≈ a 75° half-angle (a ~150° frontal arc).
 */
const HEAD_CONE_COS = 0.25;

/**
 * True if `attacker`'s head runs into a body point of `victim` within its forward cone.
 * When attacker === victim, the first SELF_SKIP points are ignored (the neck).
 */
export function headHitsSnake(attacker: Snake, victim: Snake): boolean {
  if (!attacker.alive || !victim.alive) return false;
  const headPos = attacker.segments[0];
  // Require fairly central overlap (not just edges grazing) before it counts as a hit.
  const hitDist = snakeRadius(attacker) * 0.4 + snakeRadius(victim) * 0.4;
  const startIndex = attacker === victim ? SELF_SKIP : 0;
  // broad-phase: skip distant snakes cheaply
  if (attacker !== victim) {
    const span = victim.segments.length * SEGMENT_SPACING + snakeRadius(victim) + snakeRadius(attacker);
    if (distance(headPos, victim.segments[0]) > span) return false;
  }
  const facing = fromAngle(attacker.heading);
  for (let i = startIndex; i < victim.segments.length; i++) {
    const seg = victim.segments[i];
    const d = distance(headPos, seg);
    if (d > hitDist) continue;
    if (d < 0.0001) return true; // exactly overlapping
    // only the head's forward cone is deadly
    if (dot(sub(seg, headPos), facing) / d >= HEAD_CONE_COS) return true;
  }
  return false;
}

/**
 * True once the head's leading edge reaches the wall (consistent on all four sides, rather
 * than dying when the head centre is already half over the border).
 */
export function headOutsideBorder(s: Snake, world: World): boolean {
  const h = s.segments[0];
  const r = snakeRadius(s);
  return Math.abs(h.x) + r > world.width / 2 || Math.abs(h.y) + r > world.height / 2;
}
