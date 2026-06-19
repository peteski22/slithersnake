import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBest, setBest, getName, setName, getSkin, setSkin,
  getDifficulty, setDifficulty, getMuted, setMuted, getMouseControl, setMouseControl,
  getTheme, setTheme,
} from './storage';

// Self-contained in-memory localStorage so the test needs no DOM environment.
describe('persistence', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
    });
  });

  it('keeps only the highest best score', () => {
    expect(getBest()).toBe(0);
    setBest(50);
    expect(getBest()).toBe(50);
    setBest(30); // lower → ignored
    expect(getBest()).toBe(50);
  });

  it('round-trips name, skin and difficulty with sensible defaults', () => {
    expect(getName()).toBe('Skiddles');
    expect(getSkin()).toBe('pink');
    expect(getDifficulty()).toBe('normal');
    setName('Rex');
    setSkin('dragon');
    setDifficulty('hard');
    expect(getName()).toBe('Rex');
    expect(getSkin()).toBe('dragon');
    expect(getDifficulty()).toBe('hard');
  });

  it('round-trips mute and mouse-control (with a fallback when unset)', () => {
    expect(getMuted()).toBe(false);
    setMuted(true);
    expect(getMuted()).toBe(true);

    expect(getMouseControl(true)).toBe(true); // unset -> fallback
    expect(getMouseControl(false)).toBe(false);
    setMouseControl(true);
    expect(getMouseControl(false)).toBe(true); // stored value wins over fallback
  });

  it('round-trips theme with default', () => {
    expect(getTheme()).toBe('classic');
    setTheme('dark');
    expect(getTheme()).toBe('dark');
  });
});
