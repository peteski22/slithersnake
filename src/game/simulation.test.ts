// src/game/simulation.test.ts
import { describe, it, expect } from 'vitest';
import { createGame, update, PLAYER_ID } from './simulation';
import { DIFFICULTIES } from '../config/difficulty';
import { makeFood } from './food';
import { scoreOf } from './leaderboard';
import { createSnake } from './snake';
import type { GameState } from './types';

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
    const bigBefore = st.food.filter((f) => f.big).length;
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.normal, seedRng);
    expect(player.alive).toBe(false);
    expect(st.food.filter((f) => f.big).length).toBeGreaterThan(bigBefore);
  });

  it('border is deadly on easy too (rules are difficulty-independent)', () => {
    const st = createGame('easy', 'pink', seedRng);
    const player = st.snakes.find((s) => s.id === PLAYER_ID)!;
    player.spawnGraceTicks = 0; // disable spawn invulnerability for this test
    player.path[0] = { x: st.world.width / 2 + 50, y: 0 }; // head is driven by path[0]
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.easy, seedRng);
    expect(player.alive).toBe(false);
  });

  it('increments kills on the surviving snake when one head-hits another body', () => {
    // Minimal world: just the player and one bot, no other snakes.
    const st: GameState = {
      world: { width: 4200, height: 2800 },
      snakes: [],
      food: [],
      powerups: [],
      nextFoodId: 1,
      nextPowerupId: 1,
      powerupSpawnTimer: 0,
      tick: 0,
    };
    // Bot: a horizontal line of segments near the center.
    const bot = createSnake({ id: 'bot0', name: 'Bot', isPlayer: false, skinId: 'blue', pos: { x: 0, y: 0 }, heading: 0, mass: 60, grown: true });
    // Player: head placed on bot's body, facing into it.
    const player = createSnake({ id: PLAYER_ID, name: 'You', isPlayer: true, skinId: 'pink', pos: { x: 0, y: 100 }, heading: 0, mass: 40, grown: true });
    player.spawnGraceTicks = 0;
    const mid = Math.min(4, bot.segments.length - 1);
    player.path[0] = { ...bot.segments[mid] };
    player.segments[0] = { ...bot.segments[mid] };
    player.heading = Math.atan2(
      bot.segments[mid - 1].y - bot.segments[mid].y,
      bot.segments[mid - 1].x - bot.segments[mid].x,
    );
    st.snakes.push(player, bot);
    expect(bot.kills).toBe(0);
    update(st, 1 / 60, { steerAngle: null, boost: false }, DIFFICULTIES.easy, seedRng);
    expect(player.alive).toBe(false);
    expect(bot.kills).toBe(1);
  });

  it('uses the same world size on every difficulty', () => {
    const easy = createGame('easy', 'pink', seedRng);
    const hard = createGame('hard', 'pink', seedRng);
    expect(easy.world.width).toBe(hard.world.width);
  });
});
