import type { GameState, PowerupType } from '../game/types';
import { ranking, scoreOf, kingId } from '../game/leaderboard';
import { TURBO_DURATION, SHIELD_DURATION, MAGNET_DURATION } from '../game/constants';

/** Don't replay the "You're the King!" flash more often than this (avoids respam at #1/#2). */
const KING_FLASH_COOLDOWN_MS = 9000;

/**
 * On-screen heads-up display: an editable snake name, the player's length/best up top, and a
 * live leaderboard of the top snakes (player and bots) with a crown on the current King.
 */
export class Hud {
  private root: HTMLElement;
  private scoreEl: HTMLElement;
  private boardEl: HTMLElement;
  private powerupEl: HTMLElement;
  private wasKing = false;
  private lastFlashAt = -Infinity;

  constructor(mount: HTMLElement) {
    this.root = mount;
    this.root.innerHTML = `
      <button class="mute-btn" id="hud-mute" aria-label="Toggle sound">🔊</button>
      <div class="score-pill" id="hud-score"></div>
      <div class="leaderboard">
        <h4>Leaderboard</h4>
        <div id="hud-board"></div>
      </div>
      <div class="powerup-bar hidden" id="hud-powerup"><div class="powerup-fill"></div><span class="powerup-label"></span></div>
    `;
    this.scoreEl = this.root.querySelector('#hud-score')!;
    this.boardEl = this.root.querySelector('#hud-board')!;
    this.powerupEl = this.root.querySelector('#hud-powerup')!;
  }

  /** Wire the mute button: shows the icon for `muted` and calls `onToggle` with the new state. */
  bindMute(muted: boolean, onToggle: (muted: boolean) => void): void {
    const btn = this.root.querySelector('#hud-mute') as HTMLButtonElement;
    let m = muted;
    const render = () => { btn.textContent = m ? '🔇' : '🔊'; };
    render();
    btn.addEventListener('click', () => { m = !m; render(); onToggle(m); });
  }

  update(state: GameState, playerId: string, best: number): void {
    const ranked = ranking(state.snakes);
    const player = state.snakes.find((s) => s.id === playerId);
    const king = kingId(state.snakes);

    const kills = player?.kills ?? 0;
    this.scoreEl.textContent = `Score ${player ? scoreOf(player) : 0}${kills > 0 ? `  ·  ⚡ ${kills}` : ''}  ·  🏆 ${best}`;

    // Rows are flex (name left, score right) so scores stay in a fixed column when ranks swap.
    const rows = ranked.slice(0, 5).map((s, i) => {
      const row = document.createElement('div');
      row.className = s.id === playerId ? 'lb-row you' : 'lb-row';
      const left = document.createElement('span');
      left.className = 'lb-name';
      left.textContent = `${i + 1}. ${s.id === king ? '👑 ' : ''}${s.name}`;
      const right = document.createElement('span');
      right.className = 'lb-score';
      right.textContent = String(scoreOf(s));
      row.append(left, right);
      return row;
    });
    this.boardEl.replaceChildren(...rows);

    const isKing = king === playerId;
    if (isKing && !this.wasKing) this.flashKing();
    this.wasKing = isKing;

    const pus = player?.activePowerups ?? [];
    const maxDurations: Record<PowerupType, number> = { turbo: TURBO_DURATION, shield: SHIELD_DURATION, magnet: MAGNET_DURATION };
    const colors: Record<PowerupType, string> = { turbo: '#ffe600', shield: '#42a5f5', magnet: '#b040ff' };
    const icons: Record<PowerupType, string> = { turbo: '🔥', shield: '🛡', magnet: '🧲' };
    if (pus.length > 0) {
      this.powerupEl.innerHTML = pus.map((pu) => {
        const pct = Math.max(0, pu.remaining / maxDurations[pu.type]) * 100;
        return `<div class="powerup-slot">
          <div class="powerup-fill" style="width:${pct}%;background:${colors[pu.type]}"></div>
          <span class="powerup-label">${icons[pu.type]} ${Math.ceil(pu.remaining)}s</span>
        </div>`;
      }).join('');
      this.powerupEl.classList.remove('hidden');
    } else {
      this.powerupEl.classList.add('hidden');
    }
  }

  private flashKing(): void {
    const now = performance.now();
    if (now - this.lastFlashAt < KING_FLASH_COOLDOWN_MS) return; // skip while jostling for #1
    this.lastFlashAt = now;
    this.root.querySelector('.king-flash')?.remove();
    const el = document.createElement('div');
    el.className = 'king-flash';
    el.textContent = "You're the King! 👑";
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  showToast(message: string): void {
    this.root.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  show(): void { this.root.classList.remove('hidden'); }
  hide(): void { this.root.classList.add('hidden'); }
}
