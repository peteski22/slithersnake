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
  pattern: 'solid' | 'stripes' | 'spots';
  eyes: boolean;
  spikes?: boolean;   // dragon-style back spikes
  ears?: boolean;     // dog-style ears on the head
}

export const SKINS: Skin[] = [
  { id: 'pink',    name: 'Bubblegum', body: '#ff7eb3', accent: '#ffd1e8', pattern: 'solid',   eyes: true },
  { id: 'blue',    name: 'Bluey',     body: '#4dabff', accent: '#bfe3ff', pattern: 'stripes', eyes: true },
  { id: 'green',   name: 'Leafy',     body: '#5ac85a', accent: '#bff0a0', pattern: 'spots',   eyes: true },
  { id: 'dragon',  name: 'Drako',     body: '#3fae6b', accent: '#ffd23f', pattern: 'stripes', eyes: true, spikes: true },
  { id: 'dog',     name: 'Biscuit',   body: '#c98a4b', accent: '#5a3a1e', pattern: 'spots',   eyes: true, ears: true },
  { id: 'rainbow', name: 'Rainbow',   body: '#ff7eb3', accent: '#4dabff', pattern: 'stripes', eyes: true },
  { id: 'sun',     name: 'Sunny',     body: '#ffd23f', accent: '#ff8c1a', pattern: 'stripes', eyes: true },
  { id: 'mint',    name: 'Minty',     body: '#7ef0c8', accent: '#ffffff', pattern: 'spots',   eyes: true },
];

export const getSkin = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** Draw a snake back-to-front so the head sits on top. */
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  s: Snake,
  cam: Camera,
  isKing: boolean,
): void {
  const skin = getSkin(s.skinId);
  const r = snakeRadius(s) * cam.zoom;

  // Spawn invulnerability: a smooth pulse between full colour and slightly translucent.
  // The pulse starts slow and accelerates (cubic ramp) so the player gets a "get ready"
  // cue as the timer runs out.
  if (s.spawnGraceTicks > 0) {
    const elapsedFrac = 1 - s.spawnGraceTicks / SPAWN_GRACE_TICKS; // 0 -> 1 over the grace
    const phase = Math.PI * 2 * 14 * Math.pow(elapsedFrac, 3);     // accelerating cadence
    const dip = 0.45;                                              // min alpha = 1 - dip = 0.55
    ctx.globalAlpha = 1 - dip * (0.5 - 0.5 * Math.cos(phase));     // smooth 1.0 <-> 0.55
  }

  // body
  for (let i = s.segments.length - 1; i >= 0; i--) {
    const p = worldToScreen(cam, s.segments[i]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (skin.pattern === 'stripes' && i % 2 === 0) ctx.fillStyle = skin.accent;
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

  // head details
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
