import './style.css';
import { createGame, update, respawnPlayer, PLAYER_ID } from './game/simulation';
import { DIFFICULTIES } from './config/difficulty';
import { Controls } from './input/controls';
import { makeCamera } from './render/camera';
import { render } from './render/renderer';
import { scoreOf } from './game/leaderboard';
import { Hud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = new Hud(document.getElementById('hud') as HTMLElement);

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const controls = new Controls(canvas);
controls.setMouseMode(true); // desktop testing
const rng = () => Math.random();
const settings = DIFFICULTIES.normal;

let playerName = localStorage.getItem('snake.name') || 'Skiddles';
let state = createGame('normal', 'pink', rng, playerName);
let player = state.snakes.find((s) => s.id === PLAYER_ID)!;
let best = 0; // session best length (until persistence lands)

hud.bindName(playerName, (name) => {
  playerName = name;
  localStorage.setItem('snake.name', name);
  player.name = name; // update the live snake so the leaderboard reflects it immediately
});

const FIXED_DT = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now: number) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  const input = controls.read();
  while (acc >= FIXED_DT) {
    update(state, FIXED_DT, input, settings, rng);
    acc -= FIXED_DT;
  }
  best = Math.max(best, scoreOf(player));
  if (!player.alive) {
    // Continue/respawn: drop a fresh small player into the EXISTING world so enemies keep
    // their sizes. (A full Restart — everyone resets — will live on the game-over screen.)
    respawnPlayer(state, rng, playerName);
    player = state.snakes.find((s) => s.id === PLAYER_ID)!;
  }
  const cam = makeCamera(player.segments[0], window.innerWidth, window.innerHeight, 1);
  render(ctx, state, cam);
  hud.update(state, PLAYER_ID, best);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
