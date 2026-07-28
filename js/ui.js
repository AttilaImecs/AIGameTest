export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.levelDisplay = document.getElementById('level-display');
    this.levelName = document.getElementById('level-name');
    this.timerDisplay = document.getElementById('timer-display');
    this.keyIcon = document.getElementById('key-icon');

    this.screenMenu = document.getElementById('screen-menu');
    this.screenLevelComplete = document.getElementById('screen-level-complete');
    this.screenFail = document.getElementById('screen-fail');
    this.screenWin = document.getElementById('screen-win');

    this.levelCompleteText = document.getElementById('level-complete-text');
    this.failTitle = document.getElementById('fail-title');
    this.failMessage = document.getElementById('fail-message');

    this.btnPlay = document.getElementById('btn-play');
    this.btnContinue = document.getElementById('btn-continue');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnMenuFail = document.getElementById('btn-menu-fail');
    this.btnPlayAgain = document.getElementById('btn-play-again');

    this.screens = [
      this.screenMenu,
      this.screenLevelComplete,
      this.screenFail,
      this.screenWin,
    ];
  }

  hideAllScreens() {
    for (const screen of this.screens) {
      screen.classList.add('hidden');
    }
    this.hud.classList.add('hidden');
  }

  showMenu() {
    this.hideAllScreens();
    this.screenMenu.classList.remove('hidden');
  }

  showPlaying() {
    this.hideAllScreens();
    this.hud.classList.remove('hidden');
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
    this.levelDisplay.textContent = `Level ${levelIndex + 1} / 5`;
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
