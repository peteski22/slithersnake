import { distance } from '../math/vec2';
import type { GameState, Snake, PowerupType } from './types';
import { snakeRadius } from './snake';
import { randomWorldPoint } from './food';
import {
  POWERUP_SPAWN_INTERVAL, POWERUP_MAX_ON_MAP, POWERUP_DESPAWN_AGE, POWERUP_RADIUS,
  TURBO_DURATION, SHIELD_DURATION, MAGNET_DURATION,
} from './constants';
import type { PowerupModeSettings } from '../config/powerup-mode';

const TYPES: PowerupType[] = ['turbo', 'shield', 'magnet'];

const DURATIONS: Record<PowerupType, number> = {
  turbo: TURBO_DURATION,
  shield: SHIELD_DURATION,
  magnet: MAGNET_DURATION,
};

export function spawnPowerups(state: GameState, dt: number, rng: () => number, settings?: PowerupModeSettings): void {
  const interval = settings?.spawnInterval ?? POWERUP_SPAWN_INTERVAL;
  const max = settings?.maxOnMap ?? POWERUP_MAX_ON_MAP;
  state.powerupSpawnTimer += dt;
  if (state.powerupSpawnTimer < interval) return;
  state.powerupSpawnTimer = 0;
  if (state.powerups.length >= max) return;
  const type = TYPES[Math.floor(rng() * TYPES.length)];
  state.powerups.push({
    id: state.nextPowerupId++,
    pos: randomWorldPoint(state.world, rng),
    type,
    age: 0,
  });
}

export function tryCollectPowerup(state: GameState, s: Snake): boolean {
  const head = s.segments[0];
  const reach = snakeRadius(s) + POWERUP_RADIUS;
  for (let i = 0; i < state.powerups.length; i++) {
    if (distance(head, state.powerups[i].pos) <= reach) {
      const type = state.powerups[i].type;
      const existing = s.activePowerups.find((p) => p.type === type);
      if (existing) {
        existing.remaining = DURATIONS[type];
      } else {
        s.activePowerups.push({ type, remaining: DURATIONS[type] });
      }
      state.powerups.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function hasPowerup(s: Snake, type: PowerupType): boolean {
  return s.activePowerups.some((p) => p.type === type);
}

export function tickPowerups(state: GameState, dt: number): void {
  for (const s of state.snakes) {
    for (let i = s.activePowerups.length - 1; i >= 0; i--) {
      s.activePowerups[i].remaining -= dt;
      if (s.activePowerups[i].remaining <= 0) s.activePowerups.splice(i, 1);
    }
  }
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    state.powerups[i].age += dt;
    if (state.powerups[i].age >= POWERUP_DESPAWN_AGE) state.powerups.splice(i, 1);
  }
}
