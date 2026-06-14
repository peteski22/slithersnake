import './style.css';
import { rotateToward } from './math/vec2';
import { createSnake, stepSnake, applyGrowth } from './game/snake';
import { makeCamera } from './render/camera';
import { render } from './render/renderer';
import { Controls } from './input/controls';
import { TURN_RATE, BASE_SPEED, WORLD_RADIUS } from './game/constants';
import type { GameState } from './game/types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const controls = new Controls(canvas);
controls.setMouseMode(true); // desktop testing: drive with the mouse

const state: GameState = {
  world: { radius: WORLD_RADIUS },
  snakes: [createSnake({ id: 'player', name: 'You', isPlayer: true, skinId: 'pink', pos: { x: 0, y: 0 }, heading: 0 })],
  food: [],
  nextFoodId: 1,
  tick: 0,
};
const player = state.snakes[0];

const FIXED_DT = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now: number) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  const input = controls.read();
  while (acc >= FIXED_DT) {
    if (input.steerAngle !== null) {
      player.heading = rotateToward(player.heading, input.steerAngle, TURN_RATE * FIXED_DT);
    }
    stepSnake(player, BASE_SPEED, FIXED_DT);
    applyGrowth(player);
    acc -= FIXED_DT;
  }
  const cam = makeCamera(player.segments[0], window.innerWidth, window.innerHeight, 1);
  render(ctx, state, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
