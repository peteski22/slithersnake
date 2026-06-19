// src/game/bots.test.ts
import { describe, it, expect } from 'vitest';
import { vec, fromAngle } from '../math/vec2';
import { createSnake } from './snake';
import { makeFood } from './food';
import { decideHeading, decideBoost } from './bots';
import type { GameState } from './types';
import { DIFFICULTIES } from '../config/difficulty';
import { MIN_BOOST_MASS } from './constants';

function state(width = 2000, height = 2000): GameState {
  return { world: { width, height }, snakes: [], food: [], powerups: [], nextFoodId: 1, nextPowerupId: 1, powerupSpawnTimer: 0, tick: 0 };
}

describe('bot AI', () => {
  it('steers toward the nearest food', () => {
    const st = state();
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    st.snakes.push(bot);
    makeFood(st, vec(0, 200), 1, false); // food straight "down" (+y)
    const target = decideHeading(st, bot, DIFFICULTIES.normal, () => 0.5);
    // heading should point roughly toward +y (PI/2)
    expect(Math.abs(target - Math.PI / 2)).toBeLessThan(0.6);
  });

  it('steers back inward when near the border', () => {
    const st = state(600, 600);
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(290, 0), heading: 0 });
    bot.heading = 0; // heading straight out toward +x border
    st.snakes.push(bot);
    const target = decideHeading(st, bot, DIFFICULTIES.normal, () => 0.5);
    // desired direction should have a negative x component (back toward center)
    const dir = fromAngle(target);
    expect(dir.x).toBeLessThan(0.3);
  });

  it('does not boost when low on mass', () => {
    const st = state();
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    bot.mass = MIN_BOOST_MASS; // at the floor — must keep its buffer
    st.snakes.push(bot);
    expect(decideBoost(st, bot, DIFFICULTIES.hard, () => 0)).toBe(false);
  });

  it('boosts to chase a smaller, nearby player when aggressive', () => {
    const st = state();
    const player = createSnake({ id: 'player', name: 'You', isPlayer: true, skinId: 'pink', pos: vec(50, 0), heading: 0 });
    player.mass = 20;
    const bot = createSnake({ id: 'b', name: 'Bot', isPlayer: false, skinId: 'blue', pos: vec(0, 0), heading: 0 });
    bot.mass = 100;
    st.snakes.push(player, bot);
    expect(decideBoost(st, bot, DIFFICULTIES.hard, () => 0)).toBe(true);
  });
});
