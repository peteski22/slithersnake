import type { GameState } from '../game/types';
import { ranking, scoreOf, kingId } from '../game/leaderboard';

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
  private wasKing = false;
  private lastFlashAt = -Infinity;

  constructor(mount: HTMLElement) {
    this.root = mount;
    this.root.innerHTML = `
      <input class="name-input" id="hud-name" maxlength="14" placeholder="name" aria-label="Snake name" />
      <div class="score-pill" id="hud-score"></div>
      <div class="leaderboard">
        <h4>Leaderboard</h4>
        <div id="hud-board"></div>
      </div>
    `;
    this.scoreEl = this.root.querySelector('#hud-score')!;
    this.boardEl = this.root.querySelector('#hud-board')!;
  }

  /** Wire the name field: shows `initial` and calls `onChange` (with a non-empty name) on edit. */
  bindName(initial: string, onChange: (name: string) => void): void {
    const input = this.root.querySelector('#hud-name') as HTMLInputElement;
    input.value = initial;
    input.addEventListener('input', () => onChange(input.value.trim() || 'You'));
  }

  update(state: GameState, playerId: string, best: number): void {
    const ranked = ranking(state.snakes);
    const player = state.snakes.find((s) => s.id === playerId);
    const king = kingId(state.snakes);

    this.scoreEl.textContent = `Length ${player ? scoreOf(player) : 0}  ·  🏆 ${best}`;

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

  show(): void { this.root.classList.remove('hidden'); }
  hide(): void { this.root.classList.add('hidden'); }
}
