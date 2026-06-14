import type { Snake, SnakeId } from './types';

export const scoreOf = (s: Snake): number => Math.floor(s.mass);

/** Alive snakes sorted by score, highest first. */
export function ranking(snakes: Snake[]): Snake[] {
  return snakes.filter((s) => s.alive).sort((a, b) => scoreOf(b) - scoreOf(a));
}

/** Id of the current King (top-ranked alive snake), or null if none alive. */
export function kingId(snakes: Snake[]): SnakeId | null {
  const r = ranking(snakes);
  return r.length > 0 ? r[0].id : null;
}
