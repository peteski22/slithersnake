// src/game/simulation.test.ts
import { describe, it, expect } from 'vitest';
import { createGame, update, PLAYER_ID } from './simulation';
import { DIFFICULTIES } from '../config/difficulty';
import { makeFood } from './food';
import { scoreOf } from './leaderboard';

const seedRng = () => 0.5; // deterministic

describe('simulation', () => {
  it('creates a player plus the configured number of bots', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID);
    expect(player).toBeDefined();
    expect(player!.isPlayer).toBe(true);
    const bots = st.snakes.filter((s) => !s.isPlayer);
    expect(bots.length).toBe(DIFFICULTIES.normal.botCount);
  });

  it('moves the player toward the steered heading over time', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    const startX = player.segments[0].x;
    // The player spawns at a random heading, so run a full second: enough to turn to
    // heading 0 (east) and then make clear net eastward progress regardless of start angle.
    for (let i = 0; i < 60; i++) {
      update(st, 1 / 60, { steerAngle: 0, boost: false }, DIFFICULTIES.normal, seedRng);
    }
    expect(player.segments[0].x).toBeGreaterThan(startX);
  });

  it('grows the player when it eats nearby food', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    const before = scoreOf(player);
    makeFood(st, { ...player.segments[0] }, 10, false);
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.normal, seedRng);
    expect(scoreOf(player)).toBeGreaterThan(before);
  });

  it('kills the player on a border crossing and bursts food', () => {
    const st = createGame('normal', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    player.spawnGraceTicks = 0; // disable spawn invulnerability for this test
    player.path[0] = { x: st.world.width / 2 + 50, y: 0 }; // head is driven by path[0]
    const foodBefore = st.food.length;
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.normal, seedRng);
    expect(player.alive).toBe(false);
    expect(st.food.length).toBeGreaterThan(foodBefore);
  });

  it('border is deadly on easy too (rules are difficulty-independent)', () => {
    const st = createGame('easy', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    player.spawnGraceTicks = 0; // disable spawn invulnerability for this test
    player.path[0] = { x: st.world.width / 2 + 50, y: 0 }; // head is driven by path[0]
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.easy, seedRng);
    expect(player.alive).toBe(false);
  });

  it('uses the same world size on every difficulty', () => {
    const easy = createGame('easy', 'pink', seedRng);
    const hard = createGame('hard', 'pink', seedRng);
    expect(easy.world.width).toBe(hard.world.width);
  });
});
