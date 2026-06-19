import type { Difficulty } from '../config/difficulty';
import type { FoodMode } from '../config/food-mode';
import type { Theme } from '../config/theme';
import type { PowerupMode } from '../config/powerup-mode';

/**
 * Thin wrapper over localStorage for the handful of values we persist between sessions.
 * NOTE: keep keys namespaced under "snake." and values primitive so this stays trivially safe.
 */
const KEYS = {
  best: 'snake.best',
  name: 'snake.name',
  skin: 'snake.skin',
  difficulty: 'snake.difficulty',
  muted: 'snake.muted',
  mouse: 'snake.mouse',
  foodMode: 'snake.foodMode',
  theme: 'snake.theme',
  powerupMode: 'snake.powerupMode',
} as const;

export function getBest(): number {
  return Number(localStorage.getItem(KEYS.best) ?? '0') || 0;
}
export function setBest(score: number): void {
  if (score > getBest()) localStorage.setItem(KEYS.best, String(Math.floor(score)));
}

export function getName(): string {
  return localStorage.getItem(KEYS.name) || 'Skiddles';
}
export function setName(name: string): void {
  localStorage.setItem(KEYS.name, name);
}

export function getSkin(): string {
  return localStorage.getItem(KEYS.skin) || 'pink';
}
export function setSkin(id: string): void {
  localStorage.setItem(KEYS.skin, id);
}

export function getDifficulty(): Difficulty {
  const d = localStorage.getItem(KEYS.difficulty);
  return d === 'easy' || d === 'normal' || d === 'hard' ? d : 'normal';
}
export function setDifficulty(d: Difficulty): void {
  localStorage.setItem(KEYS.difficulty, d);
}

export function getMuted(): boolean {
  return localStorage.getItem(KEYS.muted) === '1';
}
export function setMuted(muted: boolean): void {
  localStorage.setItem(KEYS.muted, muted ? '1' : '0');
}

/** Mouse-control (desktop testing) preference; `fallback` is used when nothing is stored. */
export function getMouseControl(fallback: boolean): boolean {
  const v = localStorage.getItem(KEYS.mouse);
  return v === null ? fallback : v === '1';
}
export function setMouseControl(on: boolean): void {
  localStorage.setItem(KEYS.mouse, on ? '1' : '0');
}

export function getFoodMode(): FoodMode {
  const v = localStorage.getItem(KEYS.foodMode);
  return v === 'famine' || v === 'normal' || v === 'feast' ? v : 'normal';
}
export function setFoodMode(mode: FoodMode): void {
  localStorage.setItem(KEYS.foodMode, mode);
}

export function getTheme(): Theme {
  const v = localStorage.getItem(KEYS.theme);
  return v === 'classic' || v === 'dark' ? v : 'classic';
}
export function setTheme(t: Theme): void {
  localStorage.setItem(KEYS.theme, t);
}

export function getPowerupMode(): PowerupMode {
  const v = localStorage.getItem(KEYS.powerupMode);
  return v === 'sparse' || v === 'normal' || v === 'bountiful' ? v : 'normal';
}
export function setPowerupMode(mode: PowerupMode): void {
  localStorage.setItem(KEYS.powerupMode, mode);
}
