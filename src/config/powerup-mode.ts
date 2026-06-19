export type PowerupMode = 'sparse' | 'normal' | 'bountiful';

export const POWERUP_MODE_ORDER: PowerupMode[] = ['bountiful', 'normal', 'sparse'];

export interface PowerupModeSettings {
  spawnInterval: number;
  maxOnMap: number;
}

export const POWERUP_MODES: Record<PowerupMode, PowerupModeSettings> = {
  sparse:    { spawnInterval: 30, maxOnMap: 1 },
  normal:    { spawnInterval: 18, maxOnMap: 3 },
  bountiful: { spawnInterval: 8,  maxOnMap: 6 },
};
