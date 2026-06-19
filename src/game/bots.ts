import { Vec2, sub, add, scale, distance, dot, angleOf, fromAngle } from '../math/vec2';
import type { GameState, Snake } from './types';
import type { DifficultySettings } from '../config/difficulty';
import { snakeRadius } from './snake';
import { MIN_BOOST_MASS } from './constants';

const BORDER_LOOKAHEAD = 160; // start turning inward within this distance of the border

/**
 * Decide the heading a bot wants this frame. Priority: avoid the border, avoid
 * imminent body collisions, (optionally) hunt the player, else seek nearest food.
 * `rng` is injectable for deterministic tests.
 */
export function decideHeading(
  state: GameState,
  bot: Snake,
  settings: DifficultySettings,
  rng: () => number,
): number {
  const headPos = bot.segments[0];

  // 1) Border avoidance: if near any wall, steer back toward center.
  const dx = state.world.width / 2 - Math.abs(headPos.x);
  const dy = state.world.height / 2 - Math.abs(headPos.y);
  if (Math.min(dx, dy) < BORDER_LOOKAHEAD) {
    return angleOf(scale(headPos, -1)); // point back toward (0,0)
  }

  // 2) Body avoidance (self-preservation): if another snake's body is close *ahead*, veer
  // away. Danger range scales with cunning, so smarter bots dodge earlier (less kamikaze).
  const dir = fromAngle(bot.heading);
  const danger = snakeRadius(bot) + 30 + 80 * settings.cunning;
  let threat: Vec2 | null = null;
  let threatDist = Infinity;
  for (const other of state.snakes) {
    if (!other.alive) continue;
    const startIndex = other === bot ? 6 : 0; // ignore our own neck
    for (let i = startIndex; i < other.segments.length; i += 2) {
      const seg = other.segments[i];
      const to = sub(seg, headPos);
      const d = distance(headPos, seg);
      if (d < danger && d < threatDist && dot(to, dir) > 0) { // only obstacles ahead of us
        threatDist = d;
        threat = seg;
      }
    }
  }
  if (threat) return angleOf(sub(headPos, threat)); // steer away from the obstacle

  // 3) Hunt — every snake for itself: chase the nearest *smaller* snake (player OR bot),
  // not the player specifically, so high difficulty isn't everyone ganging up on the player.
  // Shielded bots are always aggressive.
  const aggro = bot.activePowerups.some((p) => p.type === 'shield') ? 1 : settings.aggression;
  if (rng() < aggro) {
    let prey: Snake | null = null;
    let preyDist = Infinity;
    for (const other of state.snakes) {
      if (other === bot || !other.alive) continue;
      if (other.mass >= bot.mass * 1.2) continue; // only chase someone smaller
      const d = distance(headPos, other.segments[0]);
      if (d < 420 && d < preyDist) { preyDist = d; prey = other; }
    }
    if (prey) {
      // aim slightly ahead of the prey's head to cut it off
      const lead = add(prey.segments[0], scale(fromAngle(prey.heading), snakeRadius(prey) * 3));
      return angleOf(sub(lead, headPos));
    }
  }

  // 4) Seek nearby powerups (weighted by cunning).
  if (rng() < settings.cunning) {
    let puGoal: Vec2 | null = null;
    let puDist = Infinity;
    for (const pu of state.powerups) {
      const d = distance(headPos, pu.pos);
      if (d < 400 && d < puDist) { puDist = d; puGoal = pu.pos; }
    }
    if (puGoal) return angleOf(sub(puGoal, headPos));
  }

  // 5) Seek food — prefer a nearby big (dead-snake) pellet; it's worth more, so rush the
  // remains when a snake dies. Otherwise head for the nearest pellet of any kind.
  let bigGoal: Vec2 | null = null;
  let bigDist = Infinity;
  let anyGoal: Vec2 | null = null;
  let anyDist = Infinity;
  for (const f of state.food) {
    const d = distance(headPos, f.pos);
    if (f.big && d < 600 && d < bigDist) { bigDist = d; bigGoal = f.pos; }
    if (d < anyDist) { anyDist = d; anyGoal = f.pos; }
  }
  const seek = bigGoal ?? anyGoal;
  if (seek) return angleOf(sub(seek, headPos));

  // 6) Wander: keep current heading with a small random nudge.
  return bot.heading + (rng() - 0.5) * 0.4;
}

/**
 * Decide whether a bot boosts this frame. Bots boost (like the player) to chase a smaller,
 * nearby player and cut them off, or occasionally to dash for very close food. Boosting
 * sheds mass, so bots keep a buffer above MIN_BOOST_MASS. Frequency scales with the bot's
 * aggression (hunting) and cunning (food dashes). `rng` is injectable for deterministic tests.
 */
export function decideBoost(
  state: GameState,
  bot: Snake,
  settings: DifficultySettings,
  rng: () => number,
): boolean {
  if (bot.mass <= MIN_BOOST_MASS + 6) return false; // keep a safety buffer

  // boost to chase the nearest smaller snake (anyone), not the player specifically
  let nearest: Snake | null = null;
  let nearestDist = Infinity;
  for (const other of state.snakes) {
    if (other === bot || !other.alive) continue;
    const d = distance(bot.segments[0], other.segments[0]);
    if (d < nearestDist) { nearestDist = d; nearest = other; }
  }
  if (nearest && nearestDist < 220 && bot.mass > nearest.mass && rng() < settings.aggression) return true;

  let nearestFood = Infinity;
  for (const f of state.food) {
    const d = distance(bot.segments[0], f.pos);
    if (d < nearestFood) nearestFood = d;
  }
  if (nearestFood < 120 && rng() < settings.cunning * 0.1) return true;

  return false;
}
