import { parseLevel, drawMaze, TILE, TILE_SIZE } from './maze.js';
import { Player, Input } from './player.js';
import { Timer, LEVEL_TIME } from './timer.js';
import { createHazards, createCats } from './obstacles.js';
import { playLevelMusic, stopMusic } from './music.js';
import { getCombinedLevels } from './customLevels.js';

export const STATUS = {
  MENU: 'menu',
  EDITOR: 'editor',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'level_complete',
  GAME_OVER: 'game_over',
  WIN: 'win',
};

const DOOR_OPEN_DURATION = 0.5;
const GATE_OPEN_DURATION = 0.5;
const SPLASH_DURATION = 0.35;
const ROCK_SLIDE_SPEED = 220;

function createSplashParticles(x, y) {
  const particles = [];
  const dropletCount = 8;
  for (let i = 0; i < dropletCount; i++) {
    const angle = (Math.PI * 2 * i) / dropletCount + (Math.random() - 0.5) * 0.4;
    const speed = 60 + Math.random() * 40;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      age: 0,
    });
  }
  return particles;
}

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
    this.splashing = false;
    this.splashTimer = 0;
    this.splashParticles = [];
    this.pendingFailTitle = '';
    this.pendingFailMessage = '';
    this.customPlaytest = false;
    this.onCustomPlaytestExit = null;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resizeCanvas());
    }

    this.touchControls = document.getElementById('touch-controls');
  }

  resizeCanvas() {
    if (!this.level) {
      const defaultLevel = parseLevel(getCombinedLevels()[0].level);
      this.setCanvasSize(defaultLevel.cols, defaultLevel.rows);
      return;
    }
    this.setCanvasSize(this.level.cols, this.level.rows);
  }

  setCanvasSize(cols, rows) {
    // Use the visual viewport when available so the Android address bar
    // (which can collapse/expand) doesn't squash the canvas. Fall back to
    // window.innerWidth/innerHeight on older browsers.
    const vv = window.visualViewport;
    const maxWidth = (vv ? vv.width : window.innerWidth) - 8;
    // Reserve room for the D-pad on touch devices (~210px) so the canvas
    // doesn't render behind the controls.
    const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const dpadHeight = isTouchOnly ? 220 : 8;
    const maxHeight = (vv ? vv.height : window.innerHeight) - dpadHeight;

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
    stopMusic();
    this.ui.showMenu();
  }

  goToLevelSelect() {
    this.status = STATUS.MENU;
    this.stopLoop();
    stopMusic();
    this.ui.showLevelSelect();
  }

  goToEditor() {
    this.testMode = false;
    this.status = STATUS.EDITOR;
    this.stopLoop();
    stopMusic();
    this.ui.showEditor();
  }

  applyLevelData(levelData) {
    this.level = parseLevel(levelData);
    this.rocks = this.level.rocks.map((r) => ({
      ...r,
      renderX: r.col * TILE_SIZE + TILE_SIZE / 2,
      renderY: r.row * TILE_SIZE + TILE_SIZE / 2,
    }));
    this.hazards = createHazards(this.level.hazards);
    this.cats = createCats(this.level.cats);
    this.player = new Player(this.level.start.col, this.level.start.row);
    const timeLimit = Number.isFinite(levelData.timeLimit) && levelData.timeLimit > 0
      ? levelData.timeLimit
      : LEVEL_TIME;
    this.timer.reset(timeLimit);
    this.elapsedTime = 0;
    this.doorOpening = false;
    this.doorTimer = 0;
    this.doorOpenProgress = 0;
    this.gateOpening = false;
    this.gateTimer = 0;
    this.gateOpenProgress = 0;
    this.splashing = false;
    this.splashTimer = 0;
    this.splashParticles = [];
    this.setCanvasSize(this.level.cols, this.level.rows);
  }

  loadLevel(index) {
    this.applyLevelData(getCombinedLevels()[index].level);
    playLevelMusic(index);
  }

  // Used by the level editor's Test Play button: runs an ad-hoc level (not
  // in the combined list yet) through the exact same engine as a shipped
  // level. onExit(success) fires once, whether the player reaches the exit
  // or fails/times out, so the editor can decide what to show next.
  startCustomLevel(levelData, onExit) {
    this.testMode = true;
    this.customPlaytest = true;
    this.onCustomPlaytestExit = onExit;
    this.currentLevelIndex = -1;
    this.applyLevelData(levelData);
    // No music during editor playtesting -- keeps rapid iterate/retest quiet.
    this.status = STATUS.PLAYING;
    this.ui.showPlaying();
    this.timer.start();
    this.canvas.focus();
    this.startLoop();
  }

  continueToNextLevel() {
    if (this.currentLevelIndex >= getCombinedLevels().length - 1) {
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

    if (this.splashing) {
      this.splashTimer += dt;
      for (const p of this.splashParticles) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
      }
      if (this.splashTimer >= SPLASH_DURATION) {
        this.splashing = false;
        this.triggerFail(this.pendingFailTitle, this.pendingFailMessage);
      }
      return;
    }

    this.timer.update(dt);

    if (this.timer.isExpired()) {
      this.triggerFail("Time's Up!", "The snail didn't make it in time.");
      return;
    }

    this.player.update(this.input, this.level, this.rocks, dt);

    for (const rock of this.rocks) {
      const targetX = rock.col * TILE_SIZE + TILE_SIZE / 2;
      const targetY = rock.row * TILE_SIZE + TILE_SIZE / 2;
      const dx = targetX - rock.renderX;
      const dy = targetY - rock.renderY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const step = Math.min(dist, ROCK_SLIDE_SPEED * dt);
        rock.renderX += (dx / dist) * step;
        rock.renderY += (dy / dist) * step;
      } else {
        rock.renderX = targetX;
        rock.renderY = targetY;
      }
    }

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
      this.splashing = true;
      this.splashTimer = 0;
      this.splashParticles = createSplashParticles(this.player.x, this.player.y);
      this.pendingFailTitle = 'Splash!';
      this.pendingFailMessage = 'The snail fell into a water puddle.';
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
    stopMusic();

    if (this.customPlaytest) {
      this.finishCustomPlaytest(true);
      return;
    }

    if (this.testMode) {
      this.goToLevelSelect();
      return;
    }

    if (this.currentLevelIndex >= getCombinedLevels().length - 1) {
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
    stopMusic();

    if (this.customPlaytest) {
      this.finishCustomPlaytest(false);
      return;
    }

    if (this.testMode) {
      this.goToLevelSelect();
      return;
    }

    this.ui.showFail(title, message);
  }

  finishCustomPlaytest(success) {
    this.customPlaytest = false;
    this.testMode = false;
    const onExit = this.onCustomPlaytestExit;
    this.onCustomPlaytestExit = null;
    onExit?.(success);
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

      for (const p of this.splashParticles) {
        const t = p.age / SPLASH_DURATION;
        const alpha = Math.max(0, 1 - t);
        if (alpha <= 0) continue;
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = '#4fc3f7';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 3 * (1 - t * 0.5), 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }
}
