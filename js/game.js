import { LEVELS, parseLevel, drawMaze, TILE } from './maze.js';
import { Player, Input } from './player.js';
import { Timer } from './timer.js';
import { createHazards, createCats } from './obstacles.js';

export const STATUS = {
  MENU: 'menu',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'level_complete',
  GAME_OVER: 'game_over',
  WIN: 'win',
};

const DOOR_OPEN_DURATION = 0.5;
const GATE_OPEN_DURATION = 0.5;

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.input = new Input();

    this.currentLevelIndex = 0;
    this.status = STATUS.MENU;
    this.testMode = false;
    this.level = null;
    this.rocks = [];
    this.hazards = [];
    this.cats = [];
    this.player = null;
    this.timer = new Timer();
    this.elapsedTime = 0;
    this.lastTimestamp = 0;
    this.rafId = null;
    this.failReason = '';
    this.doorOpening = false;
    this.doorTimer = 0;
    this.doorOpenProgress = 0;
    this.gateOpening = false;
    this.gateTimer = 0;
    this.gateOpenProgress = 0;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.level) {
      const defaultLevel = parseLevel(LEVELS[0]);
      this.setCanvasSize(defaultLevel.cols, defaultLevel.rows);
      return;
    }
    this.setCanvasSize(this.level.cols, this.level.rows);
  }

  setCanvasSize(cols, rows) {
    const maxWidth = window.innerWidth - 40;
    const maxHeight = window.innerHeight - 40;
    const baseWidth = cols * 32;
    const baseHeight = rows * 32;
    const scale = Math.min(1, maxWidth / baseWidth, maxHeight / baseHeight);

    this.canvas.width = baseWidth;
    this.canvas.height = baseHeight;
    this.canvas.style.width = `${baseWidth * scale}px`;
    this.canvas.style.height = `${baseHeight * scale}px`;
    this.scale = scale;
  }

  start() {
    this.testMode = false;
    this.currentLevelIndex = 0;
    this.loadLevel(0);
    this.status = STATUS.PLAYING;
    this.ui.showPlaying();
    this.timer.start();
    this.canvas.focus();
    this.startLoop();
  }

  startTestLevel(index) {
    this.testMode = true;
    this.currentLevelIndex = index;
    this.loadLevel(index);
    this.status = STATUS.PLAYING;
    this.ui.showPlaying();
    this.timer.start();
    this.canvas.focus();
    this.startLoop();
  }

  retryLevel() {
    this.loadLevel(this.currentLevelIndex);
    this.status = STATUS.PLAYING;
    this.ui.showPlaying();
    this.timer.start();
    this.canvas.focus();
    this.startLoop();
  }

  goToMenu() {
    this.testMode = false;
    this.status = STATUS.MENU;
    this.stopLoop();
    this.ui.showMenu();
  }

  goToLevelSelect() {
    this.status = STATUS.MENU;
    this.stopLoop();
    this.ui.showLevelSelect();
  }

  loadLevel(index) {
    const levelData = LEVELS[index];
    this.level = parseLevel(levelData);
    this.rocks = this.level.rocks.map((r) => ({ ...r }));
    this.hazards = createHazards(this.level.hazards);
    this.cats = createCats(this.level.cats);
    this.player = new Player(this.level.start.col, this.level.start.row);
    this.timer.reset();
    this.elapsedTime = 0;
    this.doorOpening = false;
    this.doorTimer = 0;
    this.doorOpenProgress = 0;
    this.gateOpening = false;
    this.gateTimer = 0;
    this.gateOpenProgress = 0;
    this.setCanvasSize(this.level.cols, this.level.rows);
  }

  continueToNextLevel() {
    if (this.currentLevelIndex >= LEVELS.length - 1) {
      this.status = STATUS.WIN;
      this.stopLoop();
      this.ui.showWin();
      return;
    }

    this.currentLevelIndex++;
    this.loadLevel(this.currentLevelIndex);
    this.status = STATUS.PLAYING;
    this.ui.showPlaying();
    this.timer.start();
    this.canvas.focus();
    this.startLoop();
  }

  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.lastTimestamp = 0;
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.timer.stop();
  }

  loop(timestamp) {
    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;

    if (this.status === STATUS.PLAYING) {
      this.update(dt);
    }

    this.render(timestamp / 1000);

    if (this.status === STATUS.PLAYING) {
      this.rafId = requestAnimationFrame((ts) => this.loop(ts));
    }
  }

  update(dt) {
    this.elapsedTime += dt;

    if (this.doorOpening) {
      this.doorTimer += dt;
      this.doorOpenProgress = Math.min(1, this.doorTimer / DOOR_OPEN_DURATION);
      if (this.doorTimer >= DOOR_OPEN_DURATION) {
        this.triggerLevelComplete();
      }
      return;
    }

    this.timer.update(dt);

    if (this.timer.isExpired()) {
      this.triggerFail("Time's Up!", "The snail didn't make it in time.");
      return;
    }

    this.player.update(this.input, this.level, this.rocks, dt);

    for (const hazard of this.hazards) {
      hazard.update(dt, this.rocks);
      if (hazard.collidesWith(this.player.x, this.player.y, this.player.radius)) {
        this.triggerFail('Ouch!', 'The snail hit a moving hazard.');
        return;
      }
    }

    for (const cat of this.cats) {
      cat.update(dt, this.level, this.rocks, this.player);
    }

    if (this.player.isOnTile(this.level, TILE.WATER)) {
      this.triggerFail('Splash!', 'The snail fell into a water puddle.');
      return;
    }

    if (this.player.collectKey(this.level)) {
      this.gateOpening = true;
      this.gateTimer = 0;
    }

    if (this.gateOpening && this.gateOpenProgress < 1) {
      this.gateTimer += dt;
      this.gateOpenProgress = Math.min(1, this.gateTimer / GATE_OPEN_DURATION);
    }

    if (this.player.isAtExit(this.level)) {
      this.doorOpening = true;
      this.doorTimer = 0;
      this.doorOpenProgress = 0;
      return;
    }

    this.ui.updateHUD(
      this.currentLevelIndex,
      this.level.name,
      this.timer,
      this.player.hasKey,
      this.level.hasKeyOnMap,
    );
  }

  triggerLevelComplete() {
    this.status = STATUS.LEVEL_COMPLETE;
    this.timer.stop();
    this.stopLoop();

    if (this.testMode) {
      this.goToLevelSelect();
      return;
    }

    if (this.currentLevelIndex >= LEVELS.length - 1) {
      this.ui.showWin();
      this.status = STATUS.WIN;
    } else {
      this.ui.showLevelComplete(this.level.name);
    }
  }

  triggerFail(title, message) {
    this.status = STATUS.GAME_OVER;
    this.failReason = message;
    this.stopLoop();

    if (this.testMode) {
      this.goToLevelSelect();
      return;
    }

    this.ui.showFail(title, message);
  }

  render(time) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.level) {
      drawMaze(this.ctx, this.level, this.rocks, time, this.doorOpenProgress, this.gateOpenProgress);

      for (const hazard of this.hazards) {
        hazard.draw(this.ctx, time);
      }

      for (const cat of this.cats) {
        cat.draw(this.ctx, time);
      }

      if (this.player) {
        this.player.draw(this.ctx, time);
      }
    }
  }
}
