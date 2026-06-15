import type { Difficulty } from '../config/difficulty';

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
