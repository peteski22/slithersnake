import type { GameState } from '../game/types';
import type { Camera } from './camera';
import { worldToScreen } from './camera';
import { drawSnake } from '../skins/skins';
import { snakeRadius } from '../game/snake';
import { kingId } from '../game/leaderboard';

export function render(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): void {
  const { width, height } = cam;

  // outside the arena is a dark "void" so the border clearly separates play space from death
  ctx.fillStyle = '#1f1a36';
  ctx.fillRect(0, 0, width, height);

  // arena rectangle in screen space
  const tl = worldToScreen(cam, { x: -state.world.width / 2, y: -state.world.height / 2 });
  const aw = state.world.width * cam.zoom;
  const ah = state.world.height * cam.zoom;

  // playfield (sand + motion dots), clipped to the arena so the void stays clean
  ctx.save();
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, aw, ah);
  ctx.clip();
  ctx.fillStyle = '#ffe3a3';
  ctx.fillRect(tl.x, tl.y, aw, ah);
  const dotSpacing = 70;
  const left = cam.focus.x - width / 2 / cam.zoom;
  const top = cam.focus.y - height / 2 / cam.zoom;
  const right = cam.focus.x + width / 2 / cam.zoom;
  const bottom = cam.focus.y + height / 2 / cam.zoom;
  ctx.fillStyle = 'rgba(176, 130, 60, 0.18)';
  for (let wx = Math.floor(left / dotSpacing) * dotSpacing; wx <= right; wx += dotSpacing) {
    for (let wy = Math.floor(top / dotSpacing) * dotSpacing; wy <= bottom; wy += dotSpacing) {
      const p = worldToScreen(cam, { x: wx, y: wy });
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
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
    const fill = f.color ?? (f.big ? '#ffe600' : '#ff8c42');
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
}
