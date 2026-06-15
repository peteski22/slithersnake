/** What the player chose on the game-over screen. */
export type DeathChoice = 'respawn' | 'revive' | 'restart';

/**
 * Full-screen overlay dialogs (start + game over) drawn over the canvas. The start screen's
 * Play button also serves as the first user gesture that unlocks audio.
 */
export class Screens {
  constructor(private mount: HTMLElement) {}

  /** Show the start screen; resolves when the player presses Play (a user gesture). */
  showStart(best: number): Promise<void> {
    return new Promise((resolve) => {
      this.mount.innerHTML = `
        <div class="screen">
          <div class="screen-title">🐍 Slither Slink</div>
          <div class="screen-tagline">Snake</div>
          <div class="screen-sub">${best > 0 ? `Best score: ${best}` : 'Eat, grow, and rule the board.'}</div>
          <button class="btn" id="screen-play">Play</button>
        </div>`;
      this.mount.querySelector('#screen-play')!.addEventListener('click', () => {
        this.clear();
        resolve();
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
