import type { GameState } from '../game/types';
import type { Camera } from './camera';
import { worldToScreen } from './camera';
import { drawSnake } from '../skins/skins';
import { kingId } from '../game/leaderboard';

export function render(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): void {
  const { width, height } = cam;

  // background
  ctx.fillStyle = '#ffe3a3';
  ctx.fillRect(0, 0, width, height);

  // arena border ring
  const center = worldToScreen(cam, { x: 0, y: 0 });
  ctx.beginPath();
  ctx.arc(center.x, center.y, state.world.radius * cam.zoom, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#e0a85b';
  ctx.stroke();

  // food
  for (const f of state.food) {
    const p = worldToScreen(cam, f.pos);
    if (p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (f.big ? 7 : 5) * cam.zoom, 0, Math.PI * 2);
    ctx.fillStyle = f.big ? '#ffe600' : '#ff8c42';
    if (f.big) { ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 12; }
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
}
