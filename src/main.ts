import './style.css';
import { createGame, update, respawnPlayer, PLAYER_ID } from './game/simulation';
import { DIFFICULTIES, type Difficulty } from './config/difficulty';
import { SKINS } from './skins/skins';
import { Controls } from './input/controls';
import { makeCamera } from './render/camera';
import { render } from './render/renderer';
import { scoreOf, kingId } from './game/leaderboard';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';
import { AudioManager } from './audio/audio';
import * as store from './persistence/storage';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = new Hud(document.getElementById('hud') as HTMLElement);
const screens = new Screens(document.getElementById('screens') as HTMLElement);
const audio = new AudioManager(store.getMuted());

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const controls = new Controls(canvas);
const rng = () => Math.random();
const isTouch = window.matchMedia('(pointer: coarse)').matches;

// Player choices (seeded from storage; updated on the start screen).
let playerName = store.getName();
let skinId = store.getSkin();
let difficulty: Difficulty = store.getDifficulty();
let mouseControl = store.getMouseControl(!isTouch); // default: mouse on desktop, touch on tablets
let settings = DIFFICULTIES[difficulty];
let best = store.getBest();

let state = createGame(difficulty, skinId, rng, playerName);
let player = state.snakes.find((s) => s.id === PLAYER_ID)!;

type Phase = 'start' | 'playing' | 'gameover';
let phase: Phase = 'start';

hud.bindMute(audio.isMuted, (muted) => {
  audio.toggleMute();
  store.setMuted(muted);
});

const FIXED_DT = 1 / 60;
let last = performance.now();
let acc = 0;
let prevEaten = player.eatenPellets;
let prevEatenBig = player.eatenBig;
let wasKingAudio = false;
let lastKingSound = -Infinity;

function refindPlayer(): void {
  player = state.snakes.find((s) => s.id === PLAYER_ID)!;
  prevEaten = player.eatenPellets;
  prevEatenBig = player.eatenBig;
}

function enterGameOver(): void {
  phase = 'gameover';
  const deadScore = scoreOf(player);
  const deadMass = player.mass;
  store.setBest(best);
  audio.playDie();
  audio.setBoosting(false);
  hud.hide();
  void screens.showGameOver(deadScore, best).then((choice) => {
    if (choice === 'restart') {
      state = createGame(difficulty, skinId, rng, playerName); // everyone resets
    } else if (choice === 'revive') {
      respawnPlayer(state, rng, playerName, skinId, deadMass, deadScore); // keep size + score
    } else {
      respawnPlayer(state, rng, playerName, skinId); // small respawn into the existing world
    }
    refindPlayer();
    hud.show();
    phase = 'playing';
  });
}

function frame(now: number): void {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;

  if (phase === 'playing') {
    const input = controls.read();
    while (acc >= FIXED_DT) {
      update(state, FIXED_DT, input, settings, rng);
      acc -= FIXED_DT;
    }
    if (player.alive) {
      if (player.eatenPellets > prevEaten) audio.playEat();
      if (player.eatenBig > prevEatenBig) audio.playEatBig();
    }
    audio.setBoosting(player.alive && player.boosting);
    const isKing = kingId(state.snakes) === PLAYER_ID;
    if (isKing && !wasKingAudio && now - lastKingSound > 9000) {
      audio.playKing();
      lastKingSound = now;
    }
    wasKingAudio = isKing;
    best = Math.max(best, scoreOf(player));
    prevEaten = player.eatenPellets;
    prevEatenBig = player.eatenBig;
    if (!player.alive) enterGameOver();
  } else {
    acc = 0; // don't accumulate time while a dialog is up
  }

  const cam = makeCamera(player.segments[0], window.innerWidth, window.innerHeight, 1);
  render(ctx, state, cam);
  if (phase === 'playing') hud.update(state, PLAYER_ID, best);

  requestAnimationFrame(frame);
}

// Start screen first — its Play button is the user gesture that unlocks audio.
hud.hide();
void screens
  .showStart({
    best,
    initial: { name: playerName, skinId, difficulty, mouseControl },
    skins: SKINS.map((s) => ({ id: s.id, name: s.name, body: s.body })),
  })
  .then((choices) => {
    playerName = choices.name;
    skinId = choices.skinId;
    difficulty = choices.difficulty;
    mouseControl = choices.mouseControl;
    store.setName(playerName);
    store.setSkin(skinId);
    store.setDifficulty(difficulty);
    store.setMouseControl(mouseControl);
    settings = DIFFICULTIES[difficulty];
    controls.setMouseMode(mouseControl);
    audio.resume();
    audio.startMusic();
    state = createGame(difficulty, skinId, rng, playerName);
    refindPlayer();
    hud.show();
    phase = 'playing';
  });
requestAnimationFrame(frame);
