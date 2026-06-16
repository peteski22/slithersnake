import { DIFFICULTY_ORDER, type Difficulty } from '../config/difficulty';
import { SKINS, getSkin, drawSkinPreview } from '../skins/skins';

/** What the player chose on the game-over screen. */
export type DeathChoice = 'respawn' | 'revive' | 'restart';

/** Player's start-screen selections. */
export interface StartChoices {
  name: string;
  skinId: string;
  difficulty: Difficulty;
  mouseControl: boolean;
}

/**
 * Full-screen overlay dialogs (start + game over) drawn over the canvas. The start screen's
 * Play button doubles as the first user gesture that unlocks audio.
 */
export class Screens {
  constructor(private mount: HTMLElement) {}

  /** Show the start screen with pickers; resolves with the chosen options when Play is pressed. */
  showStart(opts: { best: number; initial: StartChoices }): Promise<StartChoices> {
    return new Promise((resolve) => {
      let { skinId, difficulty } = opts.initial;
      this.mount.innerHTML = `
        <div class="screen">
          <div class="screen-title">🐍 Slither Slink</div>
          <div class="screen-sub">${opts.best > 0 ? `Best score: ${opts.best}` : 'Eat, grow, and rule the board.'}</div>
          <input class="start-name" id="start-name" maxlength="14" placeholder="Your snake's name" aria-label="Snake name" />
          <div class="start-label">Difficulty</div>
          <div class="start-row" id="start-diffs">
            ${DIFFICULTY_ORDER.map((d) => `<button class="chip" data-diff="${d}">${d}</button>`).join('')}
          </div>
          <div class="start-label">Your snake</div>
          <div class="start-row start-skins" id="start-skins">
            ${SKINS.map((s) => `<button class="skin-btn" data-skin="${s.id}" title="${s.name}" aria-label="${s.name}"><canvas width="72" height="40"></canvas></button>`).join('')}
          </div>
          <label class="start-toggle"><input type="checkbox" id="start-mouse" /> Mouse control (desktop)</label>
          <button class="btn" id="screen-play">Play</button>
        </div>`;

      // Render a mini-snake preview into each skin button's canvas.
      this.mount.querySelectorAll('#start-skins .skin-btn').forEach((btn) => {
        const id = btn.getAttribute('data-skin');
        const cv = btn.querySelector('canvas') as HTMLCanvasElement | null;
        if (id && cv) drawSkinPreview(cv.getContext('2d')!, getSkin(id));
      });

      const nameEl = this.mount.querySelector('#start-name') as HTMLInputElement;
      nameEl.value = opts.initial.name;
      const mouseEl = this.mount.querySelector('#start-mouse') as HTMLInputElement;
      mouseEl.checked = opts.initial.mouseControl;

      const sync = () => {
        this.mount.querySelectorAll('[data-diff]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-diff') === difficulty));
        this.mount.querySelectorAll('[data-skin]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-skin') === skinId));
      };
      sync();

      this.mount.querySelector('#start-diffs')!.addEventListener('click', (e) => {
        const d = (e.target as HTMLElement).closest('[data-diff]')?.getAttribute('data-diff');
        if (d) { difficulty = d as Difficulty; sync(); }
      });
      this.mount.querySelector('#start-skins')!.addEventListener('click', (e) => {
        const s = (e.target as HTMLElement).closest('[data-skin]')?.getAttribute('data-skin');
        if (s) { skinId = s; sync(); }
      });
      this.mount.querySelector('#screen-play')!.addEventListener('click', () => {
        this.clear();
        resolve({
          name: nameEl.value.trim() || 'You',
          skinId,
          difficulty,
          mouseControl: mouseEl.checked,
        });
      });
    });
  }

  /** Show the game-over screen; resolves with the player's chosen action. */
  showGameOver(score: number, best: number): Promise<DeathChoice> {
    return new Promise((resolve) => {
      this.mount.innerHTML = `
        <div class="screen">
          <div class="screen-title">Game Over</div>
          <div class="screen-sub">Score <b>${score}</b>&nbsp;·&nbsp;🏆 ${best}</div>
          <div class="screen-buttons">
            <button class="btn" id="screen-revive">Revive</button>
            <button class="btn" id="screen-respawn">Respawn</button>
            <button class="btn secondary" id="screen-restart">Restart</button>
          </div>
          <p class="screen-hint">
            <b>Revive</b> — re-emerge at your size, keep your score.<br/>
            <b>Respawn</b> — jump back in small (enemies keep theirs).<br/>
            <b>Restart</b> — fresh arena, everyone resets.
          </p>
        </div>`;
      const pick = (c: DeathChoice) => () => { this.clear(); resolve(c); };
      this.mount.querySelector('#screen-revive')!.addEventListener('click', pick('revive'));
      this.mount.querySelector('#screen-respawn')!.addEventListener('click', pick('respawn'));
      this.mount.querySelector('#screen-restart')!.addEventListener('click', pick('restart'));
    });
  }

  private clear(): void {
    this.mount.innerHTML = '';
  }
}
