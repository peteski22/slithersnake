import { describe, it, expect } from 'vitest';
import { spawnPowerups, tryCollectPowerup, tickPowerups } from './powerups';
import { createSnake } from './snake';
import type { GameState } from './types';

function makeState(): GameState {
  return {
    world: { width: 4200, height: 2800 },
    snakes: [],
    food: [],
    powerups: [],
    nextFoodId: 1,
    nextPowerupId: 1,
    powerupSpawnTimer: 0,
    tick: 0,
  };
}

const rng = () => 0.5;

describe('powerups', () => {
  it('spawns a powerup when the timer expires and the map has room', () => {
    const st = makeState();
    st.powerupSpawnTimer = 20;
    spawnPowerups(st, 1 / 60, rng);
    expect(st.powerups.length).toBe(1);
    expect(st.powerupSpawnTimer).toBeLessThan(20);
  });

  it('does not spawn beyond the max', () => {
    const st = makeState();
    st.powerupSpawnTimer = 100;
    for (let i = 0; i < 10; i++) spawnPowerups(st, 1, rng);
    expect(st.powerups.length).toBeLessThanOrEqual(3);
  });

  it('collects a powerup when a snake head overlaps it', () => {
    const st = makeState();
    const snake = createSnake({ id: 'p', name: 'P', isPlayer: true, skinId: 'pink', pos: { x: 100, y: 100 }, heading: 0, mass: 40, grown: true });
    st.snakes.push(snake);
    st.powerups.push({ id: 1, pos: { x: 100, y: 100 }, type: 'turbo', age: 0 });
    tryCollectPowerup(st, snake);
    expect(snake.activePowerups.length).toBe(1);
    expect(snake.activePowerups[0].type).toBe('turbo');
    expect(st.powerups.length).toBe(0);
  });

  it('stacks different powerups when collecting a new type', () => {
    const st = makeState();
    const snake = createSnake({ id: 'p', name: 'P', isPlayer: true, skinId: 'pink', pos: { x: 100, y: 100 }, heading: 0, mass: 40, grown: true });
    snake.activePowerups.push({ type: 'turbo', remaining: 3 });
    st.snakes.push(snake);
    st.powerups.push({ id: 1, pos: { x: 100, y: 100 }, type: 'shield', age: 0 });
    tryCollectPowerup(st, snake);
    expect(snake.activePowerups.length).toBe(2);
    expect(snake.activePowerups.map((p) => p.type)).toContain('turbo');
    expect(snake.activePowerups.map((p) => p.type)).toContain('shield');
  });

  it('resets timer when collecting the same powerup type again', () => {
    const st = makeState();
    const snake = createSnake({ id: 'p', name: 'P', isPlayer: true, skinId: 'pink', pos: { x: 100, y: 100 }, heading: 0, mass: 40, grown: true });
    snake.activePowerups.push({ type: 'turbo', remaining: 1 });
    st.snakes.push(snake);
    st.powerups.push({ id: 1, pos: { x: 100, y: 100 }, type: 'turbo', age: 0 });
    tryCollectPowerup(st, snake);
    expect(snake.activePowerups.length).toBe(1);
    expect(snake.activePowerups[0].remaining).toBe(5);
  });

  it('ticks down active powerup duration and clears when expired', () => {
    const st = makeState();
    const snake = createSnake({ id: 'p', name: 'P', isPlayer: true, skinId: 'pink', pos: { x: 0, y: 0 }, heading: 0 });
    snake.activePowerups.push({ type: 'magnet', remaining: 0.5 });
    st.snakes.push(snake);
    tickPowerups(st, 1);
    expect(snake.activePowerups.length).toBe(0);
  });

  it('despawns old uncollected powerups', () => {
    const st = makeState();
    st.powerups.push({ id: 1, pos: { x: 0, y: 0 }, type: 'turbo', age: 29 });
    tickPowerups(st, 2);
    expect(st.powerups.length).toBe(0);
  });
});
