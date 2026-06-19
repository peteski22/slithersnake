import type { Snake } from '../game/types';
import type { Camera } from '../render/camera';
import { worldToScreen } from '../render/camera';
import { snakeRadius } from '../game/snake';
import { SPAWN_GRACE_TICKS } from '../game/constants';

export interface Skin {
  id: string;
  name: string;
  body: string;       // primary body color
  accent: string;     // stripe/belly accent
  pattern: 'solid' | 'stripes' | 'spots' | 'rainbow';
  eyes: boolean;
  spikes?: boolean;   // dragon-style back spikes
  ears?: boolean;     // dog-style ears on the head
}

// Distinct hues + patterns so every snake reads differently on the picker and in play.
export const SKINS: Skin[] = [
  { id: 'pink',    name: 'Bubblegum', body: '#ff6fae', accent: '#ffd1e8', pattern: 'stripes', eyes: true },
  { id: 'blue',    name: 'Ocean',     body: '#3aa0ff', accent: '#bfe3ff', pattern: 'stripes', eyes: true },
  { id: 'green',   name: 'Leaf',      body: '#4caf50', accent: '#c5f06a', pattern: 'spots',   eyes: true },
  { id: 'dragon',  name: 'Dragon',    body: '#e0553b', accent: '#ffd23f', pattern: 'stripes', eyes: true, spikes: true },
  { id: 'dog',     name: 'Pup',       body: '#c98a4b', accent: '#5a3a1e', pattern: 'spots',   eyes: true, ears: true },
  { id: 'sun',     name: 'Sunny',     body: '#ffcf33', accent: '#ff8c1a', pattern: 'stripes', eyes: true },
  { id: 'mint',    name: 'Minty',     body: '#5fe0c8', accent: '#ffffff', pattern: 'spots',   eyes: true },
  { id: 'rainbow', name: 'Rainbow',   body: '#ff6fae', accent: '#ffffff', pattern: 'rainbow', eyes: true },
];

export const SKINS_NEON: Skin[] = [
  { id: 'neon-pink',   name: 'Neon Pink',   body: '#ff2d8a', accent: '#ff8ec4', pattern: 'solid',   eyes: true },
  { id: 'neon-blue',   name: 'Neon Blue',   body: '#00c8ff', accent: '#80e4ff', pattern: 'solid',   eyes: true },
  { id: 'neon-green',  name: 'Neon Green',  body: '#39ff14', accent: '#a3ff80', pattern: 'solid',   eyes: true },
  { id: 'neon-orange', name: 'Neon Orange', body: '#ff6f00', accent: '#ffab40', pattern: 'solid',   eyes: true },
  { id: 'neon-purple', name: 'Neon Purple', body: '#b040ff', accent: '#d9a0ff', pattern: 'solid',   eyes: true },
  { id: 'neon-yellow', name: 'Neon Yellow', body: '#ffe600', accent: '#fff59d', pattern: 'solid',   eyes: true },
  { id: 'neon-red',    name: 'Neon Red',    body: '#ff1744', accent: '#ff8a80', pattern: 'solid',   eyes: true },
  { id: 'neon-white',  name: 'Ghost',       body: '#e0e0e0', accent: '#ffffff', pattern: 'solid',   eyes: true },
];

export const SKINS_CREATURES: Skin[] = [
  { id: 'tiger',   name: 'Tiger',    body: '#ff8c00', accent: '#3a1a00', pattern: 'stripes', eyes: true, ears: true },
  { id: 'cobra',   name: 'Cobra',    body: '#2e7d32', accent: '#c8e6c9', pattern: 'stripes', eyes: true },
  { id: 'fire',    name: 'Blaze',    body: '#ff3d00', accent: '#ffab00', pattern: 'stripes', eyes: true, spikes: true },
  { id: 'ice',     name: 'Frost',    body: '#4fc3f7', accent: '#e1f5fe', pattern: 'spots',   eyes: true },
  { id: 'bee',     name: 'Buzz',     body: '#ffd600', accent: '#212121', pattern: 'stripes', eyes: true },
  { id: 'coral',   name: 'Coral',    body: '#f06292', accent: '#f8bbd0', pattern: 'spots',   eyes: true },
  { id: 'shadow',  name: 'Shadow',   body: '#37474f', accent: '#78909c', pattern: 'stripes', eyes: true },
  { id: 'candy',   name: 'Candy',    body: '#e040fb', accent: '#ffffff', pattern: 'stripes', eyes: true },
];

export const ALL_SKINS = [...SKINS, ...SKINS_NEON, ...SKINS_CREATURES];

export const getSkin = (id: string): Skin => ALL_SKINS.find((s) => s.id === id) ?? SKINS[0];

/** Draw a snake back-to-front so the head sits on top. */
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  s: Snake,
  cam: Camera,
  isKing: boolean,
): void {
  const skin = getSkin(s.skinId);
  const r = snakeRadius(s) * cam.zoom;

  // Spawn invulnerability: a smooth translucency pulse that travels head -> tail and
  // accelerates as the timer runs out, so it strobes across the body near vulnerability.
  const grace = s.spawnGraceTicks > 0;
  const gracePhase = grace
    ? Math.PI * 2 * 14 * Math.pow(1 - s.spawnGraceTicks / SPAWN_GRACE_TICKS, 3)
    : 0;
  const GRACE_DIP = 0.45; // min alpha = 1 - dip = 0.55 (slightly translucent)
  const GRACE_WAVE = 0.6; // phase offset per section so the pulse ripples down the body
  const sectionAlpha = (i: number): number =>
    grace ? 1 - GRACE_DIP * (0.5 - 0.5 * Math.cos(gracePhase - i * GRACE_WAVE)) : 1;

  // body (uniform thickness)
  for (let i = s.segments.length - 1; i >= 0; i--) {
    const p = worldToScreen(cam, s.segments[i]);
    ctx.globalAlpha = sectionAlpha(i); // spawn-grace pulse ripples along the body
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (skin.pattern === 'rainbow') ctx.fillStyle = `hsl(${(i * 32) % 360} 85% 62%)`;
    else if (skin.pattern === 'stripes' && i % 2 === 0) ctx.fillStyle = skin.accent;
    else ctx.fillStyle = skin.body;
    ctx.fill();
    // outline each section so the snake reads as connected segments that visibly move
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.stroke();
    if (skin.pattern === 'spots' && i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
    if (skin.spikes && i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 1.4);
      ctx.lineTo(p.x - r * 0.5, p.y - r * 0.4);
      ctx.lineTo(p.x + r * 0.5, p.y - r * 0.4);
      ctx.closePath();
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
  }

  // head details (use the head's section alpha during spawn grace)
  ctx.globalAlpha = sectionAlpha(0);
  const head = worldToScreen(cam, s.segments[0]);
  const dir = { x: Math.cos(s.heading), y: Math.sin(s.heading) };
  const side = { x: -dir.y, y: dir.x };
  if (skin.ears) {
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(head.x + side.x * sgn * r, head.y + side.y * sgn * r, r * 0.5, r * 0.8, s.heading, 0, Math.PI * 2);
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
  }
  if (skin.eyes) {
    for (const sgn of [-1, 1]) {
      const ex = head.x + dir.x * r * 0.4 + side.x * sgn * r * 0.5;
      const ey = head.y + dir.y * r * 0.4 + side.y * sgn * r * 0.5;
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.35, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + dir.x * r * 0.12, ey + dir.y * r * 0.12, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#222'; ctx.fill();
    }
  }

  // crown for the King
  if (isKing) {
    const cx = head.x + dir.x * r * 0.2;
    const cy = head.y + dir.y * r * 0.2 - r * 2.4;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#d99e00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.8, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.3, cy + r * 0.15);
    ctx.lineTo(cx, cy - r * 0.4);
    ctx.lineTo(cx + r * 0.3, cy + r * 0.15);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.2);
    ctx.lineTo(cx + r * 0.8, cy + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.globalAlpha = 1; // reset in case spawn-grace made the snake translucent
}

/** Draw a small horizontal preview of a skin (head at the right) to fill a picker canvas. */
export function drawSkinPreview(ctx: CanvasRenderingContext2D, skin: Skin): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const n = 6;
  const r = h * 0.3;
  const cy = h / 2;
  const x0 = r + 2;
  const step = (w - r * 2 - 4) / (n - 1);

  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    if (skin.pattern === 'rainbow') ctx.fillStyle = `hsl(${(i * 36) % 360} 85% 62%)`;
    else if (skin.pattern === 'stripes' && i % 2 === 0) ctx.fillStyle = skin.accent;
    else ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.stroke();
    if (skin.pattern === 'spots' && i % 2 === 1) {
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
    if (skin.spikes && i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, cy - r * 1.5);
      ctx.lineTo(x - r * 0.5, cy - r * 0.4);
      ctx.lineTo(x + r * 0.5, cy - r * 0.4);
      ctx.closePath();
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
  }

  const hx = x0 + (n - 1) * step; // head at the right
  if (skin.ears) {
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hx, cy + sgn * r, r * 0.5, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = skin.accent;
      ctx.fill();
    }
  }
  if (skin.eyes) {
    for (const sgn of [-1, 1]) {
      const ex = hx + r * 0.35;
      const ey = cy + sgn * r * 0.45;
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + r * 0.12, ey, r * 0.15, 0, Math.PI * 2); ctx.fillStyle = '#222'; ctx.fill();
    }
  }
}
