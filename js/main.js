import { Game, STATUS } from './game.js';
import { UI } from './ui.js';
import { LEVELS, parseLevel, drawMaze } from './maze.js';

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

requestAnimationFrame(function previewLoop(time) {
  if (game.status === STATUS.MENU) {
    const level = parseLevel(LEVELS[0]);
    drawMaze(canvas.getContext('2d'), level, level.rocks, time / 1000);
    requestAnimationFrame(previewLoop);
  }
});
