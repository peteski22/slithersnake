import { DIFFICULTY_ORDER, type Difficulty } from '../config/difficulty';
import { FOOD_MODE_ORDER, type FoodMode } from '../config/food-mode';
import type { Theme } from '../config/theme';
import { SKINS, SKINS_NEON, SKINS_CREATURES, getSkin, drawSkinPreview } from '../skins/skins';

/** What the player chose on the game-over screen. */
export type DeathChoice = 'respawn' | 'revive' | 'restart' | 'menu';

/** Player's start-screen selections. */
export interface StartChoices {
  name: string;
  skinId: string;
  difficulty: Difficulty;
  foodMode: FoodMode;
  theme: Theme;
  mouseControl: boolean;
}

/**
 * Full-screen overlay dialogs (start + game over) drawn over the canvas. The start screen's
 * Play button doubles as the first user gesture that unlocks audio.
 */
export class Screens {
  constructor(private mount: HTMLElement) {}

  /** Show the start screen with pickers; resolves with the chosen options when Play is pressed. */
  showStart(opts: { best: number; initial: StartChoices; onPreview?: (partial: Partial<StartChoices>) => void }): Promise<StartChoices> {
    return new Promise((resolve) => {
      let { skinId, difficulty, foodMode, theme } = opts.initial;
      let activeTab: 'game' | 'snake' = 'game';
      this.mount.innerHTML = `
        <div class="screen">
          <div class="screen-title">🐍 Slither Slink</div>
          <div class="screen-sub">${opts.best > 0 ? `Best score: ${opts.best}` : 'Eat, grow, and rule the board.'}</div>
          <div class="start-panel">
            <div class="start-tabs" id="start-tabs">
              <button class="tab" data-tab="game">Game</button>
              <button class="tab" data-tab="snake">Snake</button>
            </div>
            <div class="tab-pane" id="pane-game">
              <div class="start-label">Difficulty</div>
              <div class="start-row" id="start-diffs">
                ${DIFFICULTY_ORDER.map((d) => {
                const color = d === 'easy' ? 'green' : d === 'normal' ? 'yellow' : 'red';
                return `<button class="chip ${color}" data-diff="${d}">${d}</button>`;
              }).join('')}
              </div>
              <div class="start-label">Food</div>
              <div class="start-row" id="start-food">
                ${FOOD_MODE_ORDER.map((m) => {
                const color = m === 'feast' ? 'green' : m === 'normal' ? 'yellow' : 'red';
                return `<button class="chip ${color}" data-food="${m}">${m}</button>`;
              }).join('')}
              </div>
              <div class="start-label">Background</div>
              <div class="start-row" id="start-theme">
                <button class="chip" data-theme="classic">Light</button>
                <button class="chip" data-theme="dark">Dark</button>
              </div>
              <label class="start-toggle"><input type="checkbox" id="start-mouse" /> Mouse control (desktop)</label>
            </div>
            <div class="tab-pane" id="pane-snake" style="display:none">
              <div class="start-label">Name</div>
              <input class="start-name" id="start-name" maxlength="14" placeholder="Your snake's name" aria-label="Snake name" />
              <div class="skin-section">
                <div class="skin-tabs" id="skin-tabs">
                  <button class="tab" data-skintab="friendly">Friendly</button>
                  <button class="tab" data-skintab="neon">Neon</button>
                  <button class="tab" data-skintab="creatures">Creatures</button>
                </div>
                <div class="skin-pane" id="skinpane-friendly">
                  <div class="start-row start-skins">
                    ${SKINS.map((s) => `<button class="skin-btn" data-skin="${s.id}" title="${s.name}" aria-label="${s.name}"><canvas width="72" height="40"></canvas></button>`).join('')}
                  </div>
                </div>
                <div class="skin-pane" id="skinpane-neon" style="display:none">
                  <div class="start-row start-skins">
                    ${SKINS_NEON.map((s) => `<button class="skin-btn" data-skin="${s.id}" title="${s.name}" aria-label="${s.name}"><canvas width="72" height="40"></canvas></button>`).join('')}
                  </div>
                </div>
                <div class="skin-pane" id="skinpane-creatures" style="display:none">
                  <div class="start-row start-skins">
                    ${SKINS_CREATURES.map((s) => `<button class="skin-btn" data-skin="${s.id}" title="${s.name}" aria-label="${s.name}"><canvas width="72" height="40"></canvas></button>`).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button class="btn" id="screen-play">Play</button>
          <a class="credit-link" href="https://buymeacoffee.com/peteski22" target="_blank" rel="noopener">Made with ♥ by peteski</a>
          <div class="version">v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</div>
        </div>`;

      // Render a mini-snake preview into each skin button's canvas.
      this.mount.querySelectorAll('.start-skins .skin-btn').forEach((btn) => {
        const id = btn.getAttribute('data-skin');
        const cv = btn.querySelector('canvas') as HTMLCanvasElement | null;
        if (id && cv) drawSkinPreview(cv.getContext('2d')!, getSkin(id));
      });

      const nameEl = this.mount.querySelector('#start-name') as HTMLInputElement;
      nameEl.value = opts.initial.name;
      const mouseEl = this.mount.querySelector('#start-mouse') as HTMLInputElement;
      mouseEl.checked = opts.initial.mouseControl;
      const paneGame = this.mount.querySelector('#pane-game') as HTMLElement;
      const paneSnake = this.mount.querySelector('#pane-snake') as HTMLElement;

      let activeSkinTab = 'friendly';
      const skinPanes = ['friendly', 'neon', 'creatures'];

      const syncTabs = () => {
        this.mount.querySelectorAll('[data-tab]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-tab') === activeTab));
        paneGame.style.display = activeTab === 'game' ? '' : 'none';
        paneSnake.style.display = activeTab === 'snake' ? '' : 'none';
      };
      const syncSkinTabs = () => {
        this.mount.querySelectorAll('[data-skintab]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-skintab') === activeSkinTab));
        for (const id of skinPanes) {
          const pane = this.mount.querySelector(`#skinpane-${id}`) as HTMLElement;
          if (pane) pane.style.display = id === activeSkinTab ? '' : 'none';
        }
      };
      syncTabs();
      syncSkinTabs();

      this.mount.querySelector('#start-tabs')!.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('[data-tab]')?.getAttribute('data-tab');
        if (t === 'game' || t === 'snake') { activeTab = t; syncTabs(); }
      });
      this.mount.querySelector('#skin-tabs')!.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('[data-skintab]')?.getAttribute('data-skintab');
        if (t && skinPanes.includes(t)) { activeSkinTab = t; syncSkinTabs(); }
      });

      const sync = () => {
        this.mount.querySelectorAll('[data-diff]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-diff') === difficulty));
        this.mount.querySelectorAll('[data-food]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-food') === foodMode));
        this.mount.querySelectorAll('[data-theme]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-theme') === theme));
        this.mount.querySelectorAll('[data-skin]').forEach((el) =>
          el.classList.toggle('selected', el.getAttribute('data-skin') === skinId));
      };
      sync();

      this.mount.querySelector('#start-diffs')!.addEventListener('click', (e) => {
        const d = (e.target as HTMLElement).closest('[data-diff]')?.getAttribute('data-diff');
        if (d) { difficulty = d as Difficulty; sync(); }
      });
      this.mount.querySelector('#start-food')!.addEventListener('click', (e) => {
        const f = (e.target as HTMLElement).closest('[data-food]')?.getAttribute('data-food');
        if (f) { foodMode = f as FoodMode; sync(); opts.onPreview?.({ foodMode }); }
      });
      this.mount.querySelector('#start-theme')!.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('[data-theme]')?.getAttribute('data-theme');
        if (t === 'classic' || t === 'dark') { theme = t; sync(); opts.onPreview?.({ theme }); }
      });
      this.mount.querySelectorAll('.start-skins').forEach((el) =>
        el.addEventListener('click', (e) => {
          const s = (e.target as HTMLElement).closest('[data-skin]')?.getAttribute('data-skin');
          if (s) { skinId = s; sync(); }
        }));
      this.mount.querySelector('#screen-play')!.addEventListener('click', () => {
        this.clear();
        resolve({
          name: nameEl.value.trim() || 'You',
          skinId,
          difficulty,
          foodMode,
          theme,
          mouseControl: mouseEl.checked,
        });
      });
    });
  }

  /** Show the game-over screen; resolves with the player's chosen action. */
  showGameOver(score: number, best: number, zaps: number): Promise<DeathChoice> {
    return new Promise((resolve) => {
      this.mount.innerHTML = `
        <div class="screen">
          <div class="screen-title">Game Over</div>
          <div class="screen-sub">Score <b>${score}</b>${zaps > 0 ? `&nbsp;·&nbsp;⚡ ${zaps}` : ''}&nbsp;·&nbsp;🏆 ${best}</div>
          <div class="death-choices">
            <div class="death-row">
              <button class="btn" id="screen-revive">Revive</button>
              <span class="death-desc">Come back at your current size and score</span>
            </div>
            <div class="death-row">
              <button class="btn" id="screen-respawn">Respawn</button>
              <span class="death-desc">Start small again, enemies keep their size</span>
            </div>
            <div class="death-row">
              <button class="btn secondary" id="screen-restart">Restart</button>
              <span class="death-desc">New game, everyone starts over</span>
            </div>
          </div>
          <button class="btn tertiary" id="screen-menu">Menu</button>
        </div>`;
      const pick = (c: DeathChoice) => () => { this.clear(); resolve(c); };
      this.mount.querySelector('#screen-revive')!.addEventListener('click', pick('revive'));
      this.mount.querySelector('#screen-respawn')!.addEventListener('click', pick('respawn'));
      this.mount.querySelector('#screen-restart')!.addEventListener('click', pick('restart'));
      this.mount.querySelector('#screen-menu')!.addEventListener('click', pick('menu'));
    });
  }

  private clear(): void {
    this.mount.innerHTML = '';
  }
}
