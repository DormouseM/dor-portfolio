/* Farm Feud direct-play H5 bundle. */

const RESULT_HOLD_MS = 4000;
const SCREEN_SLIDE_MS = 760;
const AUTO_RETURN_DELAY_MS = 3000;

const DICE_ROUNDS = Object.freeze([
  {
    id: 1,
    theme: 'positive',
    banner: 'FIRE!',
    skill: 'FIRE!',
    multiplier: 'x20',
    rollDurationMs: 500,
    boardText: 'Positive Buff ×20',
    actionLabel: 'GOOD!',
    actionType: 'POSITIVE BUFF',
    tapPrompt: "Tap to decide the farm's fate!",
    weapon: 'flame',
    weaponLabel: 'Flame hammer',
    pawStartPercent: 0,
    pawEndPercent: 25,
    moleDurationSeconds: 10,
  },
  {
    id: 2,
    theme: 'negative',
    banner: 'Small',
    skill: 'Small',
    multiplier: 'x1',
    rollDurationMs: 500,
    boardText: 'Small • x1',
    actionLabel: 'Hurry up!',
    actionType: 'Small',
    tapPrompt: 'Push on! Better boosts!',
    weapon: 'tiny',
    weaponLabel: 'Tiny wooden hammer',
    pawStartPercent: 25,
    pawEndPercent: 30,
    moleDurationSeconds: 5,
  },
  {
    id: 3,
    theme: 'super',
    banner: 'Dynamax',
    skill: 'Dynamax',
    multiplier: 'x99',
    rollDurationMs: 500,
    boardText: 'Dynamax • x99',
    actionLabel: 'Total wipe!',
    actionType: 'Dynamax',
    tapPrompt: 'Keep going! Max power!',
    weapon: 'mega',
    weaponLabel: 'Golden mega hammer',
    pawStartPercent: 30,
    pawEndPercent: 100,
    moleDurationSeconds: 10,
  },
]);

class DiceStageController {
  constructor(elements, { onLog = () => {}, moleRound = null } = {}) {
    this.el = elements;
    this.onLog = onLog;
    this.moleRound = moleRound;
    this.state = 'BOOT';
    this.roundIndex = 0;
    this.flowToken = 0;
    this.timerIds = new Set();
    this.pointerStartY = null;
  }

  get currentRound() {
    return DICE_ROUNDS[this.roundIndex];
  }

  start() {
    this.reset();
  }

  reset() {
    this.clearTimers();
    this.moleRound?.stop();
    this.flowToken += 1;
    this.roundIndex = 0;
    this.el.gameRoot.classList.remove('is-rolling', 'is-landed', 'show-action', 'show-final', 'dice-animation-active', 'is-building-house', 'is-house-built');
    this.el.finalScreen?.setAttribute('aria-hidden', 'true');
    this.el.finalVideo?.pause();
    this.el.actionScreen.setAttribute('aria-hidden', 'true');
    this.el.diceScreen.setAttribute('aria-hidden', 'false');
    this.prepareRound('reset');
  }

  prepareRound(reason = 'round_ready') {
    const round = this.currentRound;
    this.el.gameRoot.classList.remove('is-rolling', 'is-landed', 'show-action', 'show-final', 'dice-animation-active', 'is-building-house', 'is-house-built');
    this.el.finalScreen?.setAttribute('aria-hidden', 'true');
    this.el.finalVideo?.pause();
    this.el.gameRoot.dataset.rollTheme = round.theme;
    this.el.gameRoot.dataset.roundId = String(round.id);
    this.el.gameRoot.dataset.resultState = 'hidden';
    this.el.weaponPlaceholder.className = `weapon-placeholder weapon-${round.weapon}`;
    this.el.weaponPlaceholder.setAttribute('aria-label', round.weaponLabel);
    this.el.weaponPlaceholder.setAttribute('aria-hidden', 'true');
    this.el.diceScreen.setAttribute('aria-hidden', 'false');
    this.el.actionScreen.setAttribute('aria-hidden', 'true');
    this.el.rollButton.disabled = false;
    this.el.rollButton.classList.add('is-pulsing');
    this.el.roundCompleteButton.disabled = true;
    this.el.roundIndicator.textContent = `${round.id} / ${DICE_ROUNDS.length}`;
    this.el.bannerText.textContent = '';
    this.el.bannerResult.textContent = '';
    this.el.skillCallout.setAttribute('aria-label', '');
    this.el.valueCallout.setAttribute('aria-label', '');
    this.el.boardResult.textContent = '';
    this.el.tapBubbleText.textContent = "Tap to decide\nthe farm's fate!";
    this.el.tapBubble.classList.remove('is-hidden');
    this.el.rollButtonLabel.textContent = 'ROLL';
    this.el.stageStatus.textContent = 'Tap the button to reveal the dice result.';
    this.updateActionScreen(round);
    this.setState('READY', reason);
  }

  roll() {
    if (this.state !== 'READY') {
      this.log('roll_ignored', { state: this.state, reason: 'state_locked' });
      return;
    }

    const round = this.currentRound;
    const token = ++this.flowToken;
    this.setState('ROLLING', 'button_click');
    this.el.gameRoot.classList.remove('is-landed');
    void this.el.gameRoot.offsetWidth;
    this.el.gameRoot.classList.add('is-rolling');
    this.el.rollButton.disabled = true;
    this.el.rollButton.classList.remove('is-pulsing');
    this.el.rollButtonLabel.textContent = 'ROLLING';
    this.el.boardResult.textContent = '';
    this.el.stageStatus.textContent = 'Dice input and page switching are locked.';
    this.el.tapBubble.classList.add('is-hidden');
    this.log('dice_roll_start', { token, round: round.id, theme: round.theme });

    this.schedule(() => {
      if (!this.isCurrent(token, 'ROLLING')) return;
      this.el.gameRoot.classList.remove('is-rolling');
      this.el.gameRoot.classList.add('is-landed');
      this.el.gameRoot.dataset.resultState = 'visible';
      this.el.weaponPlaceholder.setAttribute('aria-hidden', 'false');
      this.el.bannerText.textContent = round.banner;
      this.el.bannerResult.textContent = round.multiplier;
      this.el.skillCallout.setAttribute('aria-label', round.skill);
      this.el.valueCallout.setAttribute('aria-label', round.multiplier);
      this.el.boardResult.textContent = round.boardText;
      this.el.stageStatus.textContent = 'Result confirmed. Moving to part 2.';
      this.setState('RESULT', 'dice_landed');
      this.log('dice_roll_complete', { token, round: round.id, skill: round.skill, multiplier: round.multiplier });
      this.schedule(() => this.showActionScreen('auto_slide'), RESULT_HOLD_MS);
    }, round.rollDurationMs);
  }

  showActionScreen(reason = 'swipe_up') {
    if (this.state !== 'RESULT') {
      this.log('screen_switch_ignored', { state: this.state, reason });
      return;
    }
    this.el.gameRoot.classList.add('show-action');
    this.el.actionScreen.setAttribute('aria-hidden', 'false');
    this.el.diceScreen.setAttribute('aria-hidden', 'true');
    const hasMoleGameplay = Boolean(this.moleRound);
    this.el.roundCompleteButton.disabled = !hasMoleGameplay ? false : true;
    if (hasMoleGameplay) {
      this.el.roundCompleteButton.disabled = true;
      const token = this.flowToken;
      this.schedule(() => {
        if (this.isCurrent(token, 'ACTION')) this.moleRound.start(this.currentRound);
      }, SCREEN_SLIDE_MS);
    }
    this.setState('ACTION', reason);
    this.log('screen_switch', { direction: 'up', round: this.currentRound.id });
  }

  completeRound() {
    if (this.state !== 'ACTION') {
      this.log('round_complete_ignored', { state: this.state });
      return;
    }

    const completedRound = this.currentRound;
    if (this.moleRound && !this.moleRound.isComplete) {
      this.log('round_complete_ignored', { state: this.state, reason: 'mole_round_not_complete' });
      return;
    }
    const isLastRound = this.roundIndex === DICE_ROUNDS.length - 1;
    const token = ++this.flowToken;
    this.moleRound?.stop();
    this.setState('RETURNING', isLastRound ? 'restart_after_round_3' : 'next_round');
    this.el.roundCompleteButton.disabled = true;
    this.el.gameRoot.classList.remove('show-action');
    this.el.diceScreen.setAttribute('aria-hidden', 'false');
    this.log('round_complete', { round: completedRound.id, isLastRound });

    this.schedule(() => {
      if (!this.isCurrent(token, 'RETURNING')) return;
      if (isLastRound) {
        this.el.diceScreen.setAttribute('aria-hidden', 'true');
        this.el.actionScreen.setAttribute('aria-hidden', 'true');
        this.el.finalScreen?.setAttribute('aria-hidden', 'false');
        this.el.gameRoot.classList.add('show-final');
        if (this.el.finalVideo) {
          this.el.finalVideo.currentTime = 0;
          void this.el.finalVideo.play().catch(() => {});
        }
        this.setState('FINAL', 'all_rounds_complete');
        return;
      }
      this.roundIndex += 1;
      this.prepareRound('next_round_ready');
    }, SCREEN_SLIDE_MS);
  }

  handlePointerStart(clientY) {
    this.pointerStartY = this.state === 'RESULT' ? clientY : null;
  }

  handlePointerEnd(clientY) {
    if (this.pointerStartY === null) return;
    const deltaY = clientY - this.pointerStartY;
    this.pointerStartY = null;
    if (deltaY <= -55) this.showActionScreen('manual_swipe');
  }

  updateActionScreen(round) {
    this.el.actionBannerText.textContent = round.banner;
    this.el.actionBannerResult.textContent = round.multiplier;
    this.el.actionRoundLabel.textContent = `ROUND ${round.id} • ${round.skill}`;
    this.el.actionCallout.textContent = round.actionLabel;
    this.el.actionResultType.textContent = round.actionType;
    this.el.actionResultValue.textContent = round.multiplier;
    this.el.pawFill.style.height = `${round.pawStartPercent}%`;
    this.el.moleTimerFill.style.width = '100%';
    this.el.moleTimerText.textContent = round.moleDurationSeconds
      ? `${round.moleDurationSeconds.toFixed(1)}s`
      : '10.0s';
    this.el.moleStatus.textContent = 'GET READY';
    this.el.moleHammer.className = `mole-hammer weapon-${round.weapon}`;
    this.el.roundCompleteButton.textContent = round.id === DICE_ROUNDS.length ? 'RESTART THREE ROLLS' : `COMPLETE ROUND ${round.id}`;
    this.el.actionStatus.textContent = `Round ${round.id} starts after the countdown.`;
  }

  enableRoundComplete(result = {}, delayMs = AUTO_RETURN_DELAY_MS) {
    if (this.state !== 'ACTION' || this.currentRound.id !== result.round) return;
    this.el.roundCompleteButton.disabled = true;
    this.el.actionStatus.textContent = `Round ${result.round} complete. Returning to the dice shortly.`;
    const token = this.flowToken;
    this.schedule(() => {
      if (!this.isCurrent(token, 'ACTION') || !this.moleRound?.isComplete) return;
      this.completeRound();
    }, delayMs);
    this.log('round_auto_return_scheduled', {
      round: result.round,
      delay_ms: delayMs,
      coin_count: result.coinCount ?? 0,
      end_percent: result.endPercent ?? this.currentRound.pawEndPercent,
    });
  }

  isCurrent(token, expectedState) {
    return token === this.flowToken && this.state === expectedState;
  }

  schedule(callback, delayMs) {
    const timerId = window.setTimeout(() => {
      this.timerIds.delete(timerId);
      callback();
    }, delayMs);
    this.timerIds.add(timerId);
  }

  clearTimers() {
    for (const timerId of this.timerIds) window.clearTimeout(timerId);
    this.timerIds.clear();
  }

  setState(state, reason) {
    this.state = state;
    this.el.devState.textContent = `${state} • R${this.currentRound.id}`;
    this.el.gameRoot.dataset.state = state;
    this.log('state_change', { state, reason, round: this.currentRound.id });
  }

  log(name, payload = {}) {
    this.onLog({ t: Math.round(performance.now()), name, ...payload });
  }
}


const COUNTDOWN_STEP_MS = 1000;
const TICK_MS = 100;

const MOLE_ROUND_CONFIGS = Object.freeze({
  1: Object.freeze({
    durationMs: 10000,
    burstTimesMs: Object.freeze([3000, 6000, 9000]),
    burstCounts: Object.freeze([4, 8, 13]),
    hitsRequired: 1,
    spawnMin: 1,
    spawnMax: 2,
    areaHit: false,
    moleVisibleMinMs: 1250,
    moleVisibleRangeMs: 450,
    startPercent: 0,
    endPercent: 25,
    hammer: 'flame',
  }),
  2: Object.freeze({
    durationMs: 5000,
    burstTimesMs: Object.freeze([2000, 4000]),
    burstCounts: Object.freeze([2, 3]),
    hitsRequired: 2,
    spawnMin: 1,
    spawnMax: 2,
    areaHit: false,
    moleVisibleMinMs: 1750,
    moleVisibleRangeMs: 550,
    startPercent: 25,
    endPercent: 30,
    hammer: 'tiny',
  }),
  3: Object.freeze({
    durationMs: 10000,
    burstTimesMs: Object.freeze([]),
    burstCounts: Object.freeze([]),
    hitsRequired: 1,
    spawnMin: 3,
    spawnMax: 4,
    areaHit: true,
    smashCoinBase: 3,
    smashCoinStep: 2,
    moleVisibleMinMs: 2250,
    moleVisibleRangeMs: 500,
    startPercent: 30,
    endPercent: 100,
    hammer: 'mega',
  }),
});

class MoleRoundController {
  constructor(elements, { onLog = () => {}, onComplete = () => {}, onHit = () => {} } = {}) {
    this.el = elements;
    this.onLog = onLog;
    this.onComplete = onComplete;
    this.onHit = onHit;
    this.state = 'IDLE';
    this.round = null;
    this.config = null;
    this.flowToken = 0;
    this.timerIds = new Set();
    this.activeHoles = new Set();
    this.hammerTimerId = null;
    this.elapsedMs = 0;
    this.coinBursts = 0;
    this.coinCount = 0;
    this.isComplete = false;
    this.shakeTimerId = null;
    this.hitShakeTimerId = null;
    this.pointerHeld = false;

    this.holes.forEach((hole, index) => {
      hole.addEventListener('click', (event) => {
        if (event?.detail > 0) return;
        this.hitMole(index);
      });
    });
    this.el.targetField?.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.el.targetField?.addEventListener('pointerup', () => this.handlePointerUp());
    this.el.targetField?.addEventListener('pointercancel', () => this.handlePointerUp());
    this.el.targetField?.addEventListener('click', (event) => {
      if (event?.detail > 0) return;
      this.smashField();
    });
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pointerup', () => this.handlePointerUp());
      window.addEventListener('pointercancel', () => this.handlePointerUp());
    }
  }

  get holes() {
    return this.el.holeGrid ? [...this.el.holeGrid.querySelectorAll('.mole-target')] : [];
  }

  start(round) {
    this.stop();
    this.round = round;
    this.config = MOLE_ROUND_CONFIGS[round?.id] ?? null;
    if (!this.config) {
      this.state = 'PLACEHOLDER';
      return;
    }

    const token = ++this.flowToken;
    this.isComplete = false;
    this.state = 'COUNTDOWN';
    this.elapsedMs = 0;
    this.coinBursts = 0;
    this.coinCount = 0;
    this.resetVisuals(this.config);
    this.el.countdownOverlay.classList.remove('is-hidden');
    this.el.countdownValue.textContent = '3';
    this.el.moleStatus.textContent = 'GET READY';
    this.el.actionStatus.textContent = `Round ${round.id} starts after the countdown.`;
    this.el.moleTimerFill.style.width = '100%';
    this.el.moleTimerText.textContent = this.formatSeconds(this.config.durationMs);
    this.el.pawFill.style.height = `${this.config.startPercent}%`;
    this.el.moleHammer.className = `mole-hammer weapon-${this.config.hammer}`;
    this.log('mole_countdown_start', { round: round.id });

    this.schedule(() => this.updateCountdown(token, '2'), COUNTDOWN_STEP_MS);
    this.schedule(() => this.updateCountdown(token, '1'), COUNTDOWN_STEP_MS * 2);
    this.schedule(() => {
      if (!this.isCurrent(token, 'COUNTDOWN')) return;
      this.el.countdownOverlay.classList.add('is-hidden');
      this.startGameplay(token);
    }, COUNTDOWN_STEP_MS * 3);
  }

  updateCountdown(token, value) {
    if (!this.isCurrent(token, 'COUNTDOWN')) return;
    this.el.countdownValue.textContent = value;
    this.el.countdownValue.classList.remove('countdown-pop-reset');
    void this.el.countdownValue.offsetWidth;
    this.el.countdownValue.classList.add('countdown-pop-reset');
    this.log('mole_countdown_tick', { value });
  }

  startGameplay(token) {
    if (!this.isCurrent(token, 'COUNTDOWN')) return;
    this.state = 'ACTIVE';
    this.el.moleStatus.textContent = this.config.areaHit ? 'TAP THE FIELD' : 'TAP THE MOLES';
    this.el.actionStatus.textContent = this.config.areaHit
      ? 'Tap the nine-hole field to smash every visible mole.'
      : this.config.hitsRequired === 2
        ? 'Each mole needs two hits before the 5 second timer ends.'
        : 'Hit the moles before the 10 second timer ends.';
    if (this.config.areaHit) this.el.targetField.classList.add('is-area-active');
    else this.el.targetField.classList.remove('is-area-active');
    this.spawnBatch(token);
    this.schedule(() => this.tick(token), TICK_MS);
    this.schedule(() => this.spawnLoop(token), 760);
    this.config.burstTimesMs.forEach((timeMs, index) => {
      this.schedule(() => this.burstCoins(token, index), timeMs);
    });
    this.log('mole_round_start', {
      round: this.round.id,
      duration_ms: this.config.durationMs,
      hits_required: this.config.hitsRequired,
    });
  }

  tick(token) {
    if (!this.isCurrent(token, 'ACTIVE')) return;
    this.elapsedMs += TICK_MS;
    const remainingMs = Math.max(0, this.config.durationMs - this.elapsedMs);
    this.el.moleTimerFill.style.width = `${(remainingMs / this.config.durationMs) * 100}%`;
    this.el.moleTimerText.textContent = this.formatSeconds(remainingMs);
    if (remainingMs <= 0) {
      this.finish(token);
      return;
    }
    this.schedule(() => this.tick(token), TICK_MS);
  }

  spawnLoop(token) {
    if (!this.isCurrent(token, 'ACTIVE')) return;
    this.spawnBatch(token);
    const delay = 650 + Math.round(Math.random() * 450);
    this.schedule(() => this.spawnLoop(token), delay);
  }

  spawnBatch(token) {
    if (!this.isCurrent(token, 'ACTIVE')) return;
    if (this.config.areaHit && this.activeHoles.size) return;
    const candidates = this.holes
      .map((_, index) => index)
      .filter((index) => !this.activeHoles.has(index));
    if (!candidates.length) return;
    const amount = Math.min(candidates.length, this.config.spawnMin + Math.floor(Math.random() * (this.config.spawnMax - this.config.spawnMin + 1)));
    const visibleMs = this.config.areaHit
      ? this.config.moleVisibleMinMs + Math.round(Math.random() * this.config.moleVisibleRangeMs)
      : null;
    for (let i = 0; i < amount; i += 1) {
      const pick = Math.floor(Math.random() * candidates.length);
      const index = candidates.splice(pick, 1)[0];
      this.showMole(index, token, visibleMs);
    }
  }

  showMole(index, token, visibleMs = null) {
    const mole = this.holes[index];
    if (!mole || !this.isCurrent(token, 'ACTIVE')) return;
    this.activeHoles.add(index);
    mole.dataset.hitStage = '0';
    mole.classList.remove('is-damaged', 'is-hit');
    mole.classList.add('is-up');
    const hideToken = this.flowToken;
    this.schedule(() => {
      if (hideToken !== this.flowToken || !this.activeHoles.has(index)) return;
      this.hideMole(index);
    }, visibleMs ?? this.config.moleVisibleMinMs + Math.round(Math.random() * this.config.moleVisibleRangeMs));
  }

  hitMole(index) {
    if (this.config?.areaHit) return;
    if (this.state !== 'ACTIVE' || !this.activeHoles.has(index)) return;
    const mole = this.holes[index];
    if (!mole || mole.classList.contains('is-hit')) return;
    const hitStage = Number(mole.dataset.hitStage ?? 0) + 1;
    mole.dataset.hitStage = `${hitStage}`;
    this.positionHammer(index);
    this.onHit(index);
    if (this.round?.id === 2) this.smallHitShake();

    if (hitStage < this.config.hitsRequired) {
      mole.classList.add('is-damaged');
      this.el.moleStatus.textContent = `HIT ${hitStage} / ${this.config.hitsRequired}`;
      this.log('mole_hit_stage', {
        hole: index + 1,
        hit_stage: hitStage,
        hits_required: this.config.hitsRequired,
        elapsed_ms: this.elapsedMs,
      });
      return;
    }

    this.activeHoles.delete(index);
    mole.classList.remove('is-damaged');
    mole.classList.add('is-hit');
    this.el.moleStatus.textContent = this.config.hitsRequired === 2 ? 'MOLE DOWN!' : 'HIT!';
    this.log('mole_hit', {
      hole: index + 1,
      hit_stage: hitStage,
      hits_required: this.config.hitsRequired,
      elapsed_ms: this.elapsedMs,
    });
    this.schedule(() => {
      mole.dataset.hitStage = '0';
      mole.classList.remove('is-damaged', 'is-hit', 'is-up');
      if (this.state === 'ACTIVE') this.el.moleStatus.textContent = 'TAP THE MOLES';
    }, 430);
  }

  handlePointerDown(event) {
    if (this.state !== 'ACTIVE') return;
    this.pointerHeld = true;
    if (event?.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (this.config?.areaHit) {
      this.smashField();
      return;
    }

    const target = event?.target?.closest?.('.mole-target');
    const index = target ? this.holes.indexOf(target) : -1;
    if (index >= 0) this.hitMole(index);
  }

  handlePointerUp() {
    if (!this.pointerHeld) return;
    this.pointerHeld = false;
    this.hideHammer();
  }

  smashField() {
    if (this.state !== 'ACTIVE' || !this.config?.areaHit || !this.activeHoles.size) return;
    const smashedHoles = [...this.activeHoles];
    this.positionAreaHammer();
    
    this.shakeScreen();

    smashedHoles.forEach((index) => {
      const mole = this.holes[index];
      this.activeHoles.delete(index);
      if (!mole) return;
      mole.dataset.hitStage = '1';
      mole.classList.remove('is-damaged');
      mole.classList.add('is-hit');
      this.onHit(index);
      this.schedule(() => {
        mole.dataset.hitStage = '0';
        mole.classList.remove('is-hit', 'is-up');
      }, 480);
    });

    const count = this.config.smashCoinBase + this.coinBursts * this.config.smashCoinStep;
    this.emitCoins(count, this.coinBursts, 'mega_smash');
    this.el.moleStatus.textContent = `MEGA SMASH x${smashedHoles.length}`;
    this.log('mega_smash', {
      smashed_moles: smashedHoles.length,
      smash_number: this.coinBursts,
      coin_count: count,
      elapsed_ms: this.elapsedMs,
    });
  }

  hideMole(index) {
    const mole = this.holes[index];
    this.activeHoles.delete(index);
    if (!mole) return;
    mole.dataset.hitStage = '0';
    mole.classList.remove('is-up', 'is-damaged', 'is-hit');
  }

  positionHammer(index) {
    const mole = this.holes[index];
    if (!mole) return;
    const fieldRect = this.el.targetField.getBoundingClientRect();
    const moleRect = mole.getBoundingClientRect();
    this.el.moleHammer.style.left = `${moleRect.left - fieldRect.left + moleRect.width / 2}px`;
    this.el.moleHammer.style.top = `${moleRect.top - fieldRect.top + moleRect.height / 2}px`;
    this.showHammer(this.pointerHeld ? null : 260);
  }

  positionAreaHammer() {
    this.el.moleHammer.style.left = '50%';
    this.el.moleHammer.style.top = '48%';
    this.showHammer(this.pointerHeld ? null : 260);
  }

  showHammer(fallbackHideMs = 260) {
    this.el.moleHammer.classList.remove('is-visible');
    void this.el.moleHammer.offsetWidth;
    this.el.moleHammer.classList.add('is-visible');
    if (this.hammerTimerId) window.clearTimeout(this.hammerTimerId);
    if (fallbackHideMs === null) {
      this.hammerTimerId = null;
      return;
    }
    this.hammerTimerId = window.setTimeout(() => {
      this.hideHammer();
    }, fallbackHideMs);
  }

  hideHammer() {
    if (this.hammerTimerId) window.clearTimeout(this.hammerTimerId);
    this.hammerTimerId = null;
    this.el.moleHammer.classList.remove('is-visible');
  }

  shakeScreen() {
    this.el.gameRoot.classList.remove('is-shaking');
    this.el.targetField.classList.remove('is-smashed');
    void this.el.gameRoot.offsetWidth;
    this.el.gameRoot.classList.add('is-shaking');
    this.el.targetField.classList.add('is-smashed');
    if (this.shakeTimerId) window.clearTimeout(this.shakeTimerId);
    this.shakeTimerId = window.setTimeout(() => {
      this.el.gameRoot.classList.remove('is-shaking');
      this.el.targetField.classList.remove('is-smashed');
      this.shakeTimerId = null;
    this.hitShakeTimerId = null;
    }, 320);
  }

  smallHitShake() {
    this.el.gameRoot.classList.remove('is-mole-hit-shaking');
    void this.el.gameRoot.offsetWidth;
    this.el.gameRoot.classList.add('is-mole-hit-shaking');
    if (this.hitShakeTimerId) window.clearTimeout(this.hitShakeTimerId);
    this.hitShakeTimerId = window.setTimeout(() => {
      this.el.gameRoot.classList.remove('is-mole-hit-shaking');
      this.hitShakeTimerId = null;
    }, 170);
  }
  burstCoins(token, burstIndex) {
    if (!this.isCurrent(token, 'ACTIVE')) return;
    const count = this.config.burstCounts[burstIndex];
    this.emitCoins(count, burstIndex, 'timer');
  }

  emitCoins(count, burstIndex, source) {
    const positions = this.coinPositions(count, burstIndex);
    for (let i = 0; i < count; i += 1) {
      const coin = this.el.coinLayer.ownerDocument.createElement('span');
      coin.className = 'coin-token';
      coin.style.setProperty('--coin-x', `${positions[i].x}%`);
      coin.style.setProperty('--coin-y', `${positions[i].y}%`);
      coin.style.setProperty('--coin-size', `${positions[i].size}px`);
      coin.style.setProperty('--coin-rotation', `${positions[i].rotation}deg`);
      coin.style.setProperty('--coin-delay', `${i * 28}ms`);
      this.el.coinLayer.appendChild(coin);
      this.coinCount += 1;
    }
    this.coinBursts += 1;
    this.el.moleStatus.textContent = `COINS x${this.coinBursts}`;
    this.log('coin_burst', { burst: this.coinBursts, count, source });
  }

  coinPositions(count, burstIndex) {
    const positions = [];
    for (let i = 0; i < count; i += 1) {
      const side = (i + burstIndex) % 4;
      const along = 7 + ((i * 19 + burstIndex * 11) % 84);
      const x = side === 0 ? along : side === 1 ? 88 + (i % 4) : side === 2 ? along : 5 + (i % 4);
      const y = side === 0 ? 7 + (i % 12) : side === 1 ? along : side === 2 ? 78 + (i % 12) : along;
      positions.push({ x, y, size: 16 + ((i + burstIndex) % 3) * 3, rotation: -25 + ((i * 37) % 70) });
    }
    return positions;
  }

  collectCoinsToMeter() {
    const layerRect = this.el.coinLayer.getBoundingClientRect();
    const trackRect = this.el.pawTrack.getBoundingClientRect();
    const targetX = trackRect.left + trackRect.width / 2 - layerRect.left;
    const targetY = trackRect.bottom - layerRect.top - 9;
    for (const coin of this.el.coinLayer.querySelectorAll('.coin-token')) {
      coin.style.setProperty('--collect-x', `${targetX}px`);
      coin.style.setProperty('--collect-y', `${targetY}px`);
    }
    this.el.coinLayer.classList.add('is-collecting');
  }

  settleMeter(percent) {
    this.el.pawFill.classList.remove('is-surging', 'is-filling');
    void this.el.pawFill.offsetWidth;
    this.el.pawFill.classList.add('is-filling');
    this.el.pawFill.style.height = `${percent}%`;
  }
  finish(token) {
    if (!this.isCurrent(token, 'ACTIVE')) return;
    this.state = 'SETTLING';
    this.clearTimers();
    if (this.hammerTimerId) window.clearTimeout(this.hammerTimerId);
    this.hammerTimerId = null;
    if (this.shakeTimerId) window.clearTimeout(this.shakeTimerId);
    this.shakeTimerId = null;
    this.hitShakeTimerId = null;
    this.el.moleHammer.classList.remove('is-visible');
    this.el.gameRoot.classList.remove('is-shaking');
    this.el.targetField.classList.remove('is-smashed', 'is-area-active');
    this.activeHoles.forEach((index) => this.hideMole(index));
    this.el.moleTimerFill.style.width = '0%';
    this.el.moleTimerText.textContent = '0.0s';
    this.log('mole_round_timeout', { round: this.round.id, coin_bursts: this.coinBursts, coin_count: this.coinCount });

    if (this.config.areaHit) {
      this.finishMegaRound(token);
      return;
    }

    this.el.moleStatus.textContent = 'COLLECTING COINS';
    this.el.actionStatus.textContent = 'All coins are moving into the paw meter.';
    this.collectCoinsToMeter();
    this.schedule(() => {
      this.state = 'COMPLETE';
      this.isComplete = true;
      const gainedPercent = this.config.endPercent - this.config.startPercent;
      this.el.coinLayer.replaceChildren();
      this.el.coinLayer.classList.remove('is-collecting');
      this.settleMeter(this.config.endPercent);
      this.el.moleStatus.textContent = `${this.config.endPercent}% STORED`;
      this.el.actionStatus.textContent = `${this.config.durationMs / 1000} seconds complete. Round ${this.round.id} adds ${gainedPercent}%, total ${this.config.endPercent}%.`;
      this.onComplete({
        round: this.round.id,
        coinBursts: this.coinBursts,
        coinCount: this.coinCount,
        gainedPercent,
        endPercent: this.config.endPercent,
      });
      this.log('mole_round_complete', { round: this.round.id, vault_percent: this.config.endPercent });
    }, 850);
  }

  finishMegaRound(token) {
    this.el.moleStatus.textContent = 'COLLECTING COINS';
    this.el.actionStatus.textContent = 'All coins are moving into the progress bar.';
    this.collectCoinsToMeter();

    this.schedule(() => {
      if (!this.isCurrent(token, 'SETTLING')) return;
      this.settleMeter(100);
      this.el.moleStatus.textContent = '100% JACKPOT';
      this.el.actionStatus.textContent = 'The progress bar is full.';
      this.log('mega_meter_surge', { round: this.round.id, from_percent: 30, to_percent: 100 });
    }, 850);

    this.schedule(() => {
      if (!this.isCurrent(token, 'SETTLING')) return;
      this.state = 'COMPLETE';
      this.isComplete = true;
      const gainedPercent = this.config.endPercent - this.config.startPercent;
      this.el.coinLayer.replaceChildren();
      this.el.coinLayer.classList.remove('is-fireworks', 'is-collecting');
      this.onComplete({
        round: this.round.id,
        coinBursts: this.coinBursts,
        coinCount: this.coinCount,
        gainedPercent,
        endPercent: this.config.endPercent,
      });
      this.log('mole_round_complete', { round: this.round.id, vault_percent: this.config.endPercent });
    }, 1700);
  }
  launchCoinFireworks() {
    const count = Math.max(24, this.coinCount);
    this.el.coinLayer.replaceChildren();
    this.el.coinLayer.classList.remove('is-collecting');
    this.el.coinLayer.classList.add('is-fireworks');

    for (let i = 0; i < count; i += 1) {
      const coin = this.el.coinLayer.ownerDocument.createElement('span');
      const angle = (Math.PI * 2 * i) / count + (i % 3) * .09;
      const distance = 82 + (i % 7) * 16;
      coin.className = 'coin-token coin-firework';
      coin.style.setProperty('--coin-size', `${14 + (i % 4) * 3}px`);
      coin.style.setProperty('--firework-x', `${Math.cos(angle) * distance}px`);
      coin.style.setProperty('--firework-y', `${Math.sin(angle) * distance}px`);
      coin.style.setProperty('--firework-spin', `${540 + (i % 5) * 140}deg`);
      coin.style.setProperty('--coin-delay', `${(i % 12) * 24}ms`);
      this.el.coinLayer.appendChild(coin);
    }
  }

  stop() {
    this.clearTimers();
    this.flowToken += 1;
    this.state = 'IDLE';
    this.isComplete = false;
    this.pointerHeld = false;
    this.activeHoles.clear();
    if (this.hammerTimerId) window.clearTimeout(this.hammerTimerId);
    this.hammerTimerId = null;
    if (this.shakeTimerId) window.clearTimeout(this.shakeTimerId);
    this.shakeTimerId = null;
    this.hitShakeTimerId = null;
    this.resetVisuals();
  }

  resetVisuals(config = this.config ?? MOLE_ROUND_CONFIGS[1]) {
    this.holes.forEach((mole) => {
      mole.dataset.hitStage = '0';
      mole.classList.remove('is-up', 'is-damaged', 'is-hit');
    });
    this.el.countdownOverlay.classList.add('is-hidden');
    this.el.countdownValue.textContent = '3';
    this.el.moleHammer.className = `mole-hammer weapon-${config.hammer}`;
    this.el.moleHammer.classList.remove('is-visible');
    this.el.gameRoot.classList.remove('is-shaking');
    this.el.targetField.classList.remove('is-smashed', 'is-area-active');
    this.el.pawFill.classList.remove('is-surging');
    this.el.coinLayer.classList.remove('is-collecting', 'is-fireworks');
    this.el.coinLayer.replaceChildren();
    this.el.moleTimerFill.style.width = '100%';
    this.el.moleTimerText.textContent = this.formatSeconds(config.durationMs);
    this.el.moleStatus.textContent = 'GET READY';
  }

  formatSeconds(durationMs) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  isCurrent(token, state) {
    return token === this.flowToken && this.state === state;
  }

  schedule(callback, delayMs) {
    const timerId = window.setTimeout(() => {
      this.timerIds.delete(timerId);
      callback();
    }, delayMs);
    this.timerIds.add(timerId);
  }

  clearTimers() {
    for (const timerId of this.timerIds) window.clearTimeout(timerId);
    this.timerIds.clear();
  }

  log(name, payload = {}) {
    this.onLog({ t: Math.round(performance.now()), name, ...payload });
  }
}



const $ = (id) => document.getElementById(id);

const elements = {
  gameRoot: $('gameRoot'),
  diceScreen: $('diceScreen'),
  actionScreen: $('actionScreen'),
  roundIndicator: $('roundIndicator'),
  bannerText: $('bannerText'),
  bannerResult: $('bannerResult'),
  rollButton: $('rollButton'),
  rollButtonLabel: $('rollButtonLabel'),
  skillDie: $('skillDie'),
  valueDie: $('valueDie'),
  redDiceGif: $('redDiceGif'),
  blueDiceGif: $('blueDiceGif'),
  skillCallout: $('skillCallout'),
  valueCallout: $('valueCallout'),
  boardResult: $('boardResult'),
  tapBubble: $('tapBubble'),
  tapBubbleText: $('tapBubbleText'),
  weaponPlaceholder: $('weaponPlaceholder'),
  stageStatus: $('stageStatus'),
  actionBannerText: $('actionBannerText'),
  actionBannerResult: $('actionBannerResult'),
  actionRoundLabel: $('actionRoundLabel'),
  actionCallout: $('actionCallout'),
  actionResultType: $('actionResultType'),
  actionResultValue: $('actionResultValue'),
  pawFill: $('pawFill'),
  pawTrack: document.querySelector('.paw-track'),
  targetField: $('targetField'),
  holeGrid: $('holeGrid'),
  countdownOverlay: $('countdownOverlay'),
  countdownValue: $('countdownValue'),
  moleTimerFill: $('moleTimerFill'),
  moleTimerText: $('moleTimerText'),
  moleStatus: $('moleStatus'),
  moleHammer: $('moleHammer'),
  coinLayer: $('coinLayer'),
  roundCompleteButton: $('roundCompleteButton'),
  actionStatus: $('actionStatus'),
  devState: $('devState'),
  devLog: $('devLog'),
  stage1BearArt: $('stage1BearArt'),
  stage1ChestArt: $('stage1ChestArt'),
  stage2BearArt: $('stage2BearArt'),
  stage2ChestArt: $('stage2ChestArt'),
  stage3BearArt: $('stage3BearArt'),
  stage3ChestArt: $('stage3ChestArt'),
  actionHouseBuildVideo: $('actionHouseBuildVideo'),
  actionHouseBuildCanvas: $('actionHouseBuildCanvas'),
  finalScreen: $('finalScreen'),
  finalVideo: $('finalVideo'),
};

const audio = {
  background: new Audio('./assets/audio/background.mp3'),
  hit: new Audio('./assets/audio/hit.mp3'),
  victory: new Audio('./assets/audio/victory.mp3'),
};
audio.background.loop = true;
audio.background.volume = .28;
audio.hit.volume = .62;
audio.victory.volume = .58;
function playEffect(sound) {
  sound.currentTime = 0;
  void sound.play().catch(() => {});
}
function startBackgroundMusic() {
  if (audio.background.paused) void audio.background.play().catch(() => {});
}
function playVictory() {
  audio.background.pause();
  audio.background.currentTime = 0;
  playEffect(audio.victory);
}
const ROUND_DICE_ANIMATIONS = Object.freeze({
  1: [
    { canvas: elements.redDiceGif, framePath: './assets/dice/r1-red3-frames', frameCount: 10 },
    { canvas: elements.blueDiceGif, framePath: './assets/dice/r1-blue4-frames', frameCount: 9 },
  ],
  2: [
    { canvas: elements.redDiceGif, framePath: './assets/dice/r1-red3-frames', frameCount: 10 },
    { canvas: elements.blueDiceGif, framePath: './assets/dice/r1-blue4-frames', frameCount: 9 },
  ],
  3: [
    { canvas: elements.redDiceGif, framePath: './assets/dice/r1-red3-frames', frameCount: 10 },
    { canvas: elements.blueDiceGif, framePath: './assets/dice/r1-blue4-frames', frameCount: 9 },
  ],
});
const ROUND_DICE_PLAY_MS = Object.freeze({ 1: 500, 2: 500, 3: 500 });

const STAGE_ART_ANIMATIONS = [
  { element: elements.stage1BearArt, path: './assets/action-stage1-bear-frames', frameCount: 13, frameMs: 67 },
  { element: elements.stage1ChestArt, path: './assets/action-stage1-chest-frames', frameCount: 14, frameMs: 67 },
  { element: elements.stage2BearArt, path: './assets/action-stage2-bear-frames', frameCount: 17, frameMs: 67 },
  { element: elements.stage2ChestArt, path: './assets/action-stage2-chest-frames', frameCount: 13, frameMs: 67 },
  { element: elements.stage3BearArt, path: './assets/action-stage3-bear-frames', frameCount: 23, frameMs: 67 },
  { element: elements.stage3ChestArt, path: './assets/action-stage3-chest-frames', frameCount: 13, frameMs: 67 },
];

for (const animation of STAGE_ART_ANIMATIONS) {
  const frames = Array.from({ length: animation.frameCount }, (_, index) => {
    const image = new Image();
    image.src = `${animation.path}/${String(index).padStart(3, '0')}.png?v=2`;
    return image;
  });
  let currentFrame = -1;
  const render = (now) => {
    const nextFrame = Math.floor(now / animation.frameMs) % animation.frameCount;
    if (nextFrame !== currentFrame) {
      currentFrame = nextFrame;
      animation.element.src = frames[nextFrame].src;
    }
    window.requestAnimationFrame(render);
  };
  window.requestAnimationFrame(render);
}

let buildVideoFrameId = 0;

const stopTransparentBuildVideo = () => {
  if (buildVideoFrameId) window.cancelAnimationFrame(buildVideoFrameId);
  buildVideoFrameId = 0;
};

const renderTransparentBuildVideo = () => {
  const video = elements.actionHouseBuildVideo;
  const canvas = elements.actionHouseBuildCanvas;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (!video.paused && !video.ended) buildVideoFrameId = window.requestAnimationFrame(renderTransparentBuildVideo);
    return;
  }
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, width, height);
  context.drawImage(video, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const brightness = Math.max(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
    if (brightness < 18) pixels.data[index + 3] = 0;
    else if (brightness < 58) pixels.data[index + 3] = Math.round(((brightness - 18) / 40) * 255);
  }
  context.putImageData(pixels, 0, 0);
  if (!video.paused && !video.ended) buildVideoFrameId = window.requestAnimationFrame(renderTransparentBuildVideo);
};

const playThirdRoundBuildSequence = () => new Promise((resolve) => {
  const video = elements.actionHouseBuildVideo;
  const root = elements.gameRoot;
  let finished = false;
  const showBuiltHouse = () => {
    if (finished) return;
    finished = true;
    stopTransparentBuildVideo();
    video.pause();
    root.classList.remove('is-building-house');
    root.classList.add('is-house-built');
    window.setTimeout(resolve, 2000);
  };
  root.classList.remove('is-house-built');
  root.classList.add('is-building-house');
  video.currentTime = 0;
  video.addEventListener('ended', showBuiltHouse, { once: true });
  video.addEventListener('error', showBuiltHouse, { once: true });
  video.play().then(() => {
    stopTransparentBuildVideo();
    renderTransparentBuildVideo();
  }).catch(showBuiltHouse);
});
const MOLE_HOLE_FRAMES = Array.from({ length: 9 }, (_, index) => {
  const image = new Image();
  image.src = `./assets/mole-hole-frames/${String(index).padStart(3, '0')}.png?v=1`;
  return image;
});
const moleHoleCanvases = Array.from(document.querySelectorAll('.mole-hole-art'));
let renderedMoleHoleFrame = -1;
const renderMoleHoleAnimation = (now) => {
  const frameIndex = Math.floor(now / 120) % MOLE_HOLE_FRAMES.length;
  if (frameIndex !== renderedMoleHoleFrame) {
    renderedMoleHoleFrame = frameIndex;
    const frame = MOLE_HOLE_FRAMES[frameIndex];
    if (frame.complete && frame.naturalWidth) {
      for (const canvas of moleHoleCanvases) {
        if (canvas.width !== 152 || canvas.height !== 96) {
          canvas.width = 152;
          canvas.height = 96;
        }
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(frame, 0, 0, canvas.width, canvas.height);
      }
    }
  }
  window.requestAnimationFrame(renderMoleHoleAnimation);
};
window.requestAnimationFrame(renderMoleHoleAnimation);
const loadMoleStateFrames = (path, count) => Array.from({ length: count }, (_, index) => {
  const image = new Image();
  image.src = `${path}/${String(index).padStart(3, '0')}.png?v=1`;
  return image;
});
const MOLE_STATE_FRAMES = Object.freeze({
  emerge: loadMoleStateFrames('./assets/mole-emerge-frames', 6),
  idle: loadMoleStateFrames('./assets/mole-idle-frames', 4),
  hit: loadMoleStateFrames('./assets/mole-hit-frames', 4),
  half: loadMoleStateFrames('./assets/mole-half-frames', 3),
});
const MOLE_IMPACT_FRAME = loadMoleStateFrames('./assets/mole-impact-frames', 1)[0];
const moleStateArt = Array.from(document.querySelectorAll('.mole-state-art')).map((canvas) => ({
  canvas,
  target: canvas.parentElement.querySelector('.mole-target'),
  state: 'hidden',
  startedAt: 0,
}));
const moleImpactArt = Array.from(document.querySelectorAll('.mole-hit-effect-art')).map((canvas) => ({ canvas, startedAt: -Infinity }));
const playMoleHitEffect = (index) => {
  const entry = moleImpactArt[index];
  if (entry) entry.startedAt = performance.now();
};
const drawMoleStateArt = (entry, frame) => {
  if (!frame.complete || !frame.naturalWidth) return;
  const { canvas } = entry;
  if (canvas.width !== 176 || canvas.height !== 160) {
    canvas.width = 176;
    canvas.height = 160;
  }
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(frame, 0, 0, canvas.width, canvas.height);
};
const renderMoleImpactEffects = (now) => {
  for (const entry of moleImpactArt) {
    const elapsed = now - entry.startedAt;
    if (elapsed < 0 || elapsed > 420 || !MOLE_IMPACT_FRAME.complete || !MOLE_IMPACT_FRAME.naturalWidth) {
      entry.canvas.style.opacity = '0';
      continue;
    }
    if (entry.canvas.width !== 120 || entry.canvas.height !== 120) {
      entry.canvas.width = 120;
      entry.canvas.height = 120;
    }
    const context = entry.canvas.getContext('2d');
    context.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
    context.drawImage(MOLE_IMPACT_FRAME, 0, 0, entry.canvas.width, entry.canvas.height);
    const progress = elapsed / 420;
    entry.canvas.style.opacity = `${1 - progress}`;
    entry.canvas.style.transform = `scale(${.8 + progress * .35})`;
  }
  window.requestAnimationFrame(renderMoleImpactEffects);
};
const renderMoleStateAnimation = (now) => {
  const roundId = Number(elements.gameRoot.dataset.roundId);
  const useStateArt = roundId === 1 || roundId === 2 || roundId === 3;
  for (const entry of moleStateArt) {
    const nextState = !useStateArt || !entry.target.classList.contains('is-up')
      ? 'hidden'
      : entry.target.classList.contains('is-hit') ? 'hit'
      : roundId === 2 && entry.target.classList.contains('is-damaged') ? 'damaged' : 'up';
    if (entry.state !== nextState) {
      entry.state = nextState;
      entry.startedAt = now;
    }
    if (nextState === 'hidden') {
      const context = entry.canvas.getContext('2d');
      context.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
      continue;
    }
    const elapsed = now - entry.startedAt;
    const frames = nextState === 'hit'
      ? MOLE_STATE_FRAMES.hit
      : nextState === 'damaged' ? MOLE_STATE_FRAMES.half
      : elapsed < 480 ? MOLE_STATE_FRAMES.emerge : MOLE_STATE_FRAMES.idle;
    const frameMs = frames === MOLE_STATE_FRAMES.idle ? 120 : 80;
    const frameIndex = nextState === 'hit'
      ? Math.min(frames.length - 1, Math.floor(elapsed / frameMs))
      : Math.floor(elapsed / frameMs) % frames.length;
    drawMoleStateArt(entry, frames[frameIndex]);
  }
  window.requestAnimationFrame(renderMoleStateAnimation);
};
window.requestAnimationFrame(renderMoleStateAnimation);
window.requestAnimationFrame(renderMoleImpactEffects);
// Preserve the video end card instead of looping back to its first frame.
elements.finalVideo?.addEventListener('ended', () => {
  const finalMoment = Math.max(0, elements.finalVideo.duration - .05);
  if (Number.isFinite(finalMoment)) elements.finalVideo.currentTime = finalMoment;
  elements.finalVideo.pause();
});
const restartRoundDice = (() => {
  const playersByRound = new Map(Object.entries(ROUND_DICE_ANIMATIONS).map(([roundId, animations]) => [
    Number(roundId),
    animations.map(({ canvas, framePath, frameCount }) => {
      const context = canvas.getContext('2d');
      const frames = Array.from({ length: frameCount }, (_, index) => {
        const image = new Image();
        image.src = `${framePath}/${String(index).padStart(3, '0')}.png`;
        return image;
      });
      return { canvas, context, frames, frameCount };
    }),
  ]));
  let activePlayers = [];
  let activeDurationMs = ROUND_DICE_PLAY_MS[1];
  let startedAt = null;

  const render = (now) => {
    if (startedAt !== null) {
      const progress = Math.min(1, (now - startedAt) / activeDurationMs);
      for (const player of activePlayers) {
        const frameIndex = Math.min(player.frameCount - 1, Math.floor(progress * (player.frameCount - 1)));
        const frame = player.frames[frameIndex];
        if (frame.complete && frame.naturalWidth) {
          player.context.clearRect(0, 0, player.canvas.width, player.canvas.height);
          player.context.drawImage(frame, 0, 0, player.canvas.width, player.canvas.height);
        }
      }
    }
    window.requestAnimationFrame(render);
  };
  window.requestAnimationFrame(render);

  return (roundId) => {
    activePlayers = playersByRound.get(roundId) ?? [];
    activeDurationMs = ROUND_DICE_PLAY_MS[roundId] ?? ROUND_DICE_PLAY_MS[1];
    startedAt = performance.now();
    elements.gameRoot.classList.add('dice-animation-active');
  };
})();
let controller;
const moleRound = new MoleRoundController(elements, {
  onLog(event) {
    elements.devLog.textContent = `${JSON.stringify(event)}\n${elements.devLog.textContent}`.slice(0, 4800);
  },
  onComplete(result) {
    playVictory();
    if (result.round === 3) {
      void playThirdRoundBuildSequence().then(() => controller?.enableRoundComplete(result, 0));
      return;
    }
    controller?.enableRoundComplete(result);
  },
  onHit(index) {
    playEffect(audio.hit);
    if (Number.isInteger(index)) playMoleHitEffect(index);
  },
});

controller = new DiceStageController(elements, {
  onLog(event) {
    elements.devLog.textContent = `${JSON.stringify(event)}\n${elements.devLog.textContent}`.slice(0, 4800);
  },
  moleRound,
});

elements.rollButton.addEventListener('click', () => {
  if (controller.state === 'READY') restartRoundDice(controller.currentRound.id);
  startBackgroundMusic();
  controller.roll();
});
elements.roundCompleteButton.addEventListener('click', () => controller.completeRound());
elements.gameRoot.addEventListener('pointerdown', (event) => controller.handlePointerStart(event.clientY));
elements.gameRoot.addEventListener('pointerup', (event) => controller.handlePointerEnd(event.clientY));
document.getElementById('resetButton').addEventListener('click', () => controller.reset());

controller.start();

