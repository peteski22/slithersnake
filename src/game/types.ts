import type { Vec2 } from '../math/vec2';

export type SnakeId = string;

export interface Snake {
  id: SnakeId;
  name: string;
  isPlayer: boolean;
  skinId: string;
  /** segments[0] is the head; subsequent points trail the head (resampled from `path`). */
  segments: Vec2[];
  /** Dense trail of recent head positions (head-first); the body is sampled along it. */
  path: Vec2[];
  heading: number; // radians, current facing
  mass: number;        // drives both length (segment count) and girth (radius)
  score: number;       // accumulated points (pellets + body pellets + kills); independent of mass
  eatenPellets: number; // running count of ambient pellets eaten (drives the eat sound cue)
  eatenBig: number;     // running count of dead-snake body pellets eaten (distinct sound cue)
  kills: number;
  boosting: boolean;
  activePowerups: ActivePowerup[];
  alive: boolean;
  boostDropTimer: number; // internal: time accumulator for boost food drops
  spawnGraceTicks: number; // invulnerable countdown while the collapsed body extends at spawn
}

export interface Food {
  id: number;
  pos: Vec2;
  value: number;
  big: boolean;     // true for glowing pellets from dead snakes
  color?: string;   // dead-snake / boost pellets take the snake's colour; ambient pellets leave this unset
  owner?: SnakeId;  // the snake that dropped it (boost trail) — re-eating your own scores nothing
}

export interface World {
  // Rectangular arena centered at (0,0): spans x in [-width/2, width/2], y in [-height/2, height/2].
  width: number;
  height: number;
}

export type PowerupType = 'turbo' | 'shield' | 'magnet';

export interface ActivePowerup {
  type: PowerupType;
  remaining: number;
}

export interface Powerup {
  id: number;
  pos: Vec2;
  type: PowerupType;
  age: number;
}

export interface GameState {
  world: World;
  snakes: Snake[];
  food: Food[];
  powerups: Powerup[];
  nextFoodId: number;
  nextPowerupId: number;
  powerupSpawnTimer: number;
  tick: number;
  foodSettings?: { densityMultiplier: number; respawnRate: number };
  powerupSettings?: { spawnInterval: number; maxOnMap: number };
}

/** Per-frame player intent produced by the input layer. */
export interface InputState {
  /** Desired heading in radians, or null if the player isn't steering this frame. */
  steerAngle: number | null;
  boost: boolean;
}
