import { LEVELS } from './maze.js';

export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.levelDisplay = document.getElementById('level-display');
    this.levelName = document.getElementById('level-name');
    this.timerDisplay = document.getElementById('timer-display');
    this.keyIcon = document.getElementById('key-icon');

    this.screenMenu = document.getElementById('screen-menu');
    this.screenLevelSelect = document.getElementById('screen-level-select');
    this.screenLevelComplete = document.getElementById('screen-level-complete');
    this.screenFail = document.getElementById('screen-fail');
    this.screenWin = document.getElementById('screen-win');

    this.levelCompleteText = document.getElementById('level-complete-text');
    this.failTitle = document.getElementById('fail-title');
    this.failMessage = document.getElementById('fail-message');

    this.btnPlay = document.getElementById('btn-play');
    this.btnTestGame = document.getElementById('btn-test-game');
    this.levelSelectGroup = document.getElementById('level-select-group');
    this.btnBackToMenu = document.getElementById('btn-back-to-menu');
    this.btnContinue = document.getElementById('btn-continue');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnMenuFail = document.getElementById('btn-menu-fail');
    this.btnPlayAgain = document.getElementById('btn-play-again');

    this.screens = [
      this.screenMenu,
      this.screenLevelSelect,
      this.screenLevelComplete,
      this.screenFail,
      this.screenWin,
    ];

    this.touchControls = document.getElementById('touch-controls');

    this.buildLevelSelectButtons();
  }

  buildLevelSelectButtons() {
    this.levelSelectGroup.innerHTML = '';
    LEVELS.forEach((level, index) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary level-btn';
      btn.textContent = `${index + 1}. ${level.name}`;
      btn.dataset.level = String(index);
      this.levelSelectGroup.appendChild(btn);
    });
  }

  hideAllScreens() {
    for (const screen of this.screens) {
      screen.classList.add('hidden');
    }
    this.hud.classList.add('hidden');
    if (this.touchControls) this.touchControls.classList.add('hidden');
  }

  showMenu() {
    this.hideAllScreens();
    this.screenMenu.classList.remove('hidden');
  }

  showLevelSelect() {
    this.hideAllScreens();
    this.screenLevelSelect.classList.remove('hidden');
  }

  showPlaying() {
    this.hideAllScreens();
    this.hud.classList.remove('hidden');
    if (this.touchControls) this.touchControls.classList.remove('hidden');
    // Best-effort portrait lock; Android requires a user gesture first,
    // and this is the first time the user has tapped to start.
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(() => {});
    }
  }

  showLevelComplete(levelName) {
    this.hideAllScreens();
    this.levelCompleteText.textContent = `${levelName} cleared!`;
    this.screenLevelComplete.classList.remove('hidden');
  }

  showFail(title, message) {
    this.hideAllScreens();
    this.failTitle.textContent = title;
    this.failMessage.textContent = message;
    this.screenFail.classList.remove('hidden');
  }

  showWin() {
    this.hideAllScreens();
    this.screenWin.classList.remove('hidden');
  }

  updateHUD(levelIndex, levelName, timer, hasKey, showKey) {
    this.levelDisplay.textContent = `Level ${levelIndex + 1} / ${LEVELS.length}`;
    this.levelName.textContent = levelName;
    this.timerDisplay.textContent = timer.format();

    if (timer.isWarning()) {
      this.timerDisplay.classList.add('warning');
    } else {
      this.timerDisplay.classList.remove('warning');
    }

    if (showKey) {
      this.keyIcon.classList.remove('hidden');
      this.keyIcon.classList.toggle('lit', hasKey);
      this.keyIcon.classList.toggle('dim', !hasKey);
    } else {
      this.keyIcon.classList.add('hidden');
    }
  }

  onPlay(callback) {
    this.btnPlay.addEventListener('click', callback);
  }

  onTestGame(callback) {
    this.btnTestGame.addEventListener('click', callback);
  }

  onSelectLevel(callback) {
    this.levelSelectGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.level-btn');
      if (btn) callback(Number(btn.dataset.level));
    });
  }

  onBackToMenu(callback) {
    this.btnBackToMenu.addEventListener('click', callback);
  }

  onContinue(callback) {
    this.btnContinue.addEventListener('click', callback);
  }

  onRetry(callback) {
    this.btnRetry.addEventListener('click', callback);
  }

  onMenu(callback) {
    this.btnMenuFail.addEventListener('click', callback);
  }

  onPlayAgain(callback) {
    this.btnPlayAgain.addEventListener('click', callback);
  }
}
