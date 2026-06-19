import type { GameState } from '../game/types';
import type { Camera } from './camera';
import type { Theme } from '../config/theme';
import { worldToScreen } from './camera';
import { drawSnake } from '../skins/skins';
import { snakeRadius } from '../game/snake';
import { kingId } from '../game/leaderboard';

export function render(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera, theme: Theme = 'classic'): void {
  const { width, height } = cam;

  // outside the arena is a dark "void" so the border clearly separates play space from death
  ctx.fillStyle = '#1f1a36';
  ctx.fillRect(0, 0, width, height);

  // arena rectangle in screen space
  const tl = worldToScreen(cam, { x: -state.world.width / 2, y: -state.world.height / 2 });
  const aw = state.world.width * cam.zoom;
  const ah = state.world.height * cam.zoom;

  // playfield, clipped to the arena so the void stays clean
  ctx.save();
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, aw, ah);
  ctx.clip();

  const left = cam.focus.x - width / 2 / cam.zoom;
  const top_ = cam.focus.y - height / 2 / cam.zoom;
  const right = cam.focus.x + width / 2 / cam.zoom;
  const bottom = cam.focus.y + height / 2 / cam.zoom;

  if (theme === 'dark') {
    ctx.fillStyle = '#1a3a3a';
    ctx.fillRect(tl.x, tl.y, aw, ah);
    const hexR = 40;
    const hexH = hexR * Math.sqrt(3);
    const colW = hexR * 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let col = Math.floor(left / colW) - 1; col <= Math.ceil(right / colW) + 1; col++) {
      const cx = col * colW;
      const offset = col % 2 === 0 ? 0 : hexH / 2;
      for (let row = Math.floor(top_ / hexH) - 1; row <= Math.ceil(bottom / hexH) + 1; row++) {
        const cy = row * hexH + offset;
        const p = worldToScreen(cam, { x: cx, y: cy });
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i + Math.PI / 6;
          const hx = p.x + hexR * cam.zoom * Math.cos(a);
          const hy = p.y + hexR * cam.zoom * Math.sin(a);
          if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else {
    ctx.fillStyle = '#ffe3a3';
    ctx.fillRect(tl.x, tl.y, aw, ah);
    const dotSpacing = 70;
    ctx.fillStyle = 'rgba(176, 130, 60, 0.18)';
    for (let wx = Math.floor(left / dotSpacing) * dotSpacing; wx <= right; wx += dotSpacing) {
      for (let wy = Math.floor(top_ / dotSpacing) * dotSpacing; wy <= bottom; wy += dotSpacing) {
        const p = worldToScreen(cam, { x: wx, y: wy });
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5 * cam.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // arena border (rectangle) — red to signal the deadly edge
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#e23b3b';
  ctx.strokeRect(tl.x, tl.y, aw, ah);

  // food
  for (const f of state.food) {
    const p = worldToScreen(cam, f.pos);
    if (p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (f.big ? 8 : 5) * cam.zoom, 0, Math.PI * 2);
    const fill = f.color ?? (f.big ? '#ffe600' : `hsl(${(f.id * 137) % 360} 80% 58%)`);
    ctx.fillStyle = fill;
    if (f.big) { ctx.shadowColor = fill; ctx.shadowBlur = 12; }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // snakes (player drawn last so it's on top)
  const king = kingId(state.snakes);
  const ordered = [...state.snakes].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
  for (const s of ordered) {
    if (!s.alive) continue;
    drawSnake(ctx, s, cam, s.id === king);
  }

  // name plates above each snake's head (yours highlighted), drawn on top of all snakes
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  for (const s of ordered) {
    if (!s.alive) continue;
    const h = worldToScreen(cam, s.segments[0]);
    if (h.x < -80 || h.y < -40 || h.x > width + 80 || h.y > height + 40) continue;
    const y = h.y - snakeRadius(s) * cam.zoom - 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillStyle = s.isPlayer ? '#ffe600' : '#ffffff';
    ctx.strokeText(s.name, h.x, y);
    ctx.fillText(s.name, h.x, y);
  }

  // King tracker: when the King is another snake and off-screen, point to them with a
  // crown + arrow pinned to the screen edge, so you can hunt them down.
  const kingSnake = king ? state.snakes.find((s) => s.id === king && s.alive) : undefined;
  if (kingSnake && !kingSnake.isPlayer) {
    const kp = worldToScreen(cam, kingSnake.segments[0]);
    const onScreen = kp.x >= 0 && kp.x <= width && kp.y >= 0 && kp.y <= height;
    if (!onScreen) {
      const cx = width / 2;
      const cy = height / 2;
      const dx = kp.x - cx;
      const dy = kp.y - cy;
      const angle = Math.atan2(dy, dx);
      const margin = 44;
      const halfW = width / 2 - margin;
      const halfH = height / 2 - margin;
      const scaleEdge = Math.min(
        Math.abs(dx) > 0.001 ? halfW / Math.abs(dx) : Infinity,
        Math.abs(dy) > 0.001 ? halfH / Math.abs(dy) : Infinity,
      );
      const ex = cx + dx * scaleEdge;
      const ey = cy + dy * scaleEdge;
      // arrow pointing toward the King
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#b97e00';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // crown just inside the arrow
      ctx.font = '22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', ex - Math.cos(angle) * 26, ey - Math.sin(angle) * 26);
    }
  }
}
