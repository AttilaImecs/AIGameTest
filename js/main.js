import { Game, STATUS } from './game.js';
import { UI } from './ui.js';
import { LEVELS, parseLevel, drawMaze } from './maze.js';
import { Player } from './player.js';

// Register service worker for offline PWA install. Failures are non-fatal
// (e.g. http://localhost in some browsers blocks SW).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

const canvas = document.getElementById('game-canvas');
const ui = new UI();
const game = new Game(canvas, ui);

function drawMenuPreview() {
  const level = parseLevel(LEVELS[0]);
  game.setCanvasSize(level.cols, level.rows);
  const ctx = canvas.getContext('2d');
  drawMaze(ctx, level, level.rocks, 0);
}

ui.onPlay(() => game.start());
ui.onTestGame(() => ui.showLevelSelect());
ui.onSelectLevel((index) => game.startTestLevel(index));
ui.onBackToMenu(() => game.goToMenu());
ui.onContinue(() => game.continueToNextLevel());
ui.onRetry(() => game.retryLevel());
ui.onMenu(() => game.goToMenu());
ui.onPlayAgain(() => game.start());

ui.showMenu();
drawMenuPreview();

// Small decorative snail that crawls back and forth in the entrance corridor,
// so the title screen makes it obvious what kind of character you're playing.
const previewLevel = parseLevel(LEVELS[0]);
const previewPlayer = new Player(previewLevel.start.col, previewLevel.start.row);
const previewInput = { up: false, down: false, left: false, right: false, slow: false };
const PREVIEW_MIN_COL = previewLevel.start.col + 1;
const PREVIEW_MAX_COL = previewLevel.start.col + 9;
let previewDirection = 1;
let previewLastTime = 0;

requestAnimationFrame(function previewLoop(time) {
  if (game.status === STATUS.MENU) {
    const dt = previewLastTime ? Math.min((time - previewLastTime) / 1000, 0.05) : 0;
    previewLastTime = time;

    const col = previewPlayer.x / 32;
    if (col >= PREVIEW_MAX_COL) previewDirection = -1;
    else if (col <= PREVIEW_MIN_COL) previewDirection = 1;
    previewInput.right = previewDirection > 0;
    previewInput.left = previewDirection < 0;
    previewPlayer.update(previewInput, previewLevel, [], dt);

    const ctx = canvas.getContext('2d');
    drawMaze(ctx, previewLevel, previewLevel.rocks, time / 1000);
    previewPlayer.draw(ctx, time / 1000);
    requestAnimationFrame(previewLoop);
  }
});
