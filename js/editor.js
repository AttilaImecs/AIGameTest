// Level editor: builds a level in the same {name, grid, hazards, cats} shape
// used everywhere else in the game, so parseLevel/drawMaze/Game work on it
// completely unmodified. Shares the main #game-canvas with the real game --
// only one of them is ever actively drawing to it at a time, gated by
// game.status.

import { TILE, TILE_SIZE, parseLevel, drawMaze } from './maze.js';
import { STATUS } from './game.js';
import { LEVEL_TIME } from './timer.js';
import {
  getCombinedLevels,
  saveCustomLevel,
  loadCustomLevels,
  deleteCustomLevel,
  exportCustomLevels,
  importCustomLevels,
} from './customLevels.js';
import { checkReachability } from './levelValidate.js';

const DRAG_TOOLS = ['wall', 'path', 'mud', 'water', 'rock', 'gate'];
const PAINT_CHARS = {
  wall: TILE.WALL,
  mud: TILE.MUD,
  water: TILE.WATER,
  rock: TILE.ROCK,
  gate: TILE.GATE,
  sword: TILE.SWORD,
};
const TARGET_HAZARD_PX_PER_SEC = 90;

const TOOL_HINTS = {
  wall: 'Click or drag to place walls.',
  path: 'Click or drag to erase back to open path.',
  mud: 'Click or drag to place mud (slows the snail).',
  water: 'Click or drag to place water (instant fail if touched).',
  rock: 'Click or drag to place pushable rocks.',
  key: 'Click to place the key (only one allowed).',
  gate: 'Click to place gates (the key opens all of them).',
  sword: 'Click to place a Diamond Sword (grants 20s of immunity that slashes nearby Zombies/Creepers). Switch to Erase to remove one.',
  start: "Click to set the snail's starting tile (only one allowed).",
  exit: 'Click to set the exit tile (only one allowed).',
  cat: 'Click to add a cat. Click an existing cat to remove it.',
  hazard: 'Click a start tile, then an end tile on the same row/column to draw a patrol line.',
  zombie: 'Click to add a zombie. Click an existing zombie to remove it.',
  creeper: 'Click to add a creeper. Click an existing creeper to remove it.',
};

export class Editor {
  constructor(canvas, game, ui) {
    this.canvas = canvas;
    this.game = game;
    this.ui = ui;

    this.nameInput = document.getElementById('editor-level-name');
    this.colsInput = document.getElementById('editor-cols');
    this.rowsInput = document.getElementById('editor-rows');
    this.timerMinutesInput = document.getElementById('editor-timer-minutes');
    this.timerSecondsInput = document.getElementById('editor-timer-seconds');
    this.newGridBtn = document.getElementById('editor-new-grid-btn');
    this.clearBtn = document.getElementById('editor-clear-btn');
    this.hintEl = document.getElementById('editor-hint');
    this.hazardListEl = document.getElementById('editor-hazard-list');
    this.catListEl = document.getElementById('editor-cat-list');
    this.zombieListEl = document.getElementById('editor-zombie-list');
    this.creeperListEl = document.getElementById('editor-creeper-list');
    this.warningEl = document.getElementById('editor-warning');
    this.errorEl = document.getElementById('editor-error');
    this.testPlayBtn = document.getElementById('editor-test-play-btn');
    this.statusText = document.getElementById('editor-status');
    this.positionInput = document.getElementById('editor-publish-position');
    this.publishBtn = document.getElementById('editor-publish-btn');
    this.backBtn = document.getElementById('editor-back-btn');
    this.myLevelsList = document.getElementById('editor-my-levels-list');
    this.exportBtn = document.getElementById('editor-export-btn');
    this.importBtn = document.getElementById('editor-import-btn');
    this.transferTextarea = document.getElementById('editor-transfer-textarea');
    this.transferStatus = document.getElementById('editor-transfer-status');
    this.editingIndicator = document.getElementById('editor-editing-indicator');
    this.editingIndicatorText = document.getElementById('editor-editing-indicator-text');
    this.cancelEditBtn = document.getElementById('editor-cancel-edit-btn');
    this.toolButtons = Array.from(document.querySelectorAll('#editor-tool-palette .tool-btn'));

    this.currentTool = 'wall';
    this.pointerActive = false;
    this.lastPaintedCell = null;
    this.hazardDraft = null;
    this.verified = false;
    this.verifiedSnapshot = null;
    this.editingId = null;

    this.newGrid(
      parseInt(this.colsInput.value, 10) || 16,
      parseInt(this.rowsInput.value, 10) || 10,
    );
    this.positionInput.value = String(getCombinedLevels().length + 1);

    this.bindEvents();
  }

  bindEvents() {
    for (const btn of this.toolButtons) {
      btn.addEventListener('click', () => {
        this.currentTool = btn.dataset.tool;
        this.hazardDraft = null;
        for (const b of this.toolButtons) b.classList.toggle('active', b === btn);
        this.hintEl.textContent = TOOL_HINTS[this.currentTool] || '';
      });
    }

    this.newGridBtn.addEventListener('click', () => {
      const cols = parseInt(this.colsInput.value, 10) || 16;
      const rows = parseInt(this.rowsInput.value, 10) || 10;
      this.newGrid(cols, rows);
    });
    this.clearBtn.addEventListener('click', () => this.clearGrid());

    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    window.addEventListener('pointerup', () => this.handlePointerUp());
    window.addEventListener('pointercancel', () => this.handlePointerUp());

    this.testPlayBtn.addEventListener('click', () => this.handleTestPlay());
    this.publishBtn.addEventListener('click', () => this.handlePublish());
    this.backBtn.addEventListener('click', () => this.game.goToMenu());

    this.nameInput.addEventListener('input', () => this.onGridChanged());
    this.timerMinutesInput.addEventListener('input', () => this.onGridChanged());
    this.timerSecondsInput.addEventListener('input', () => this.onGridChanged());

    this.exportBtn.addEventListener('click', () => this.handleExport());
    this.importBtn.addEventListener('click', () => this.handleImport());

    this.cancelEditBtn.addEventListener('click', () => {
      this.nameInput.value = '';
      this.timerMinutesInput.value = String(Math.floor(LEVEL_TIME / 60));
      this.timerSecondsInput.value = String(LEVEL_TIME % 60);
      this.newGrid(16, 10);
    });
  }

  // ---- Grid lifecycle ----

  createBlankGrid(cols, rows) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const border = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
        row.push(border ? TILE.WALL : TILE.PATH);
      }
      grid.push(row);
    }
    return grid;
  }

  newGrid(cols, rows) {
    this.cols = Math.max(6, Math.min(60, cols));
    this.rows = Math.max(5, Math.min(40, rows));
    this.grid = this.createBlankGrid(this.cols, this.rows);
    this.grid[1][1] = TILE.START;
    this.grid[this.rows - 2][this.cols - 2] = TILE.EXIT;
    this.hazards = [];
    this.cats = [];
    this.zombies = [];
    this.creepers = [];
    this.hazardDraft = null;
    this.verified = false;
    this.verifiedSnapshot = null;
    this.editingId = null;
    this.updateEditingIndicator();

    if (this.game.status === STATUS.EDITOR) {
      this.game.setCanvasSize(this.cols, this.rows);
    }
    this.clearError();
    this.renderEntityLists();
    this.renderMyLevels();
    this.updateWarning();
    this.onGridChanged();
  }

  clearGrid() {
    this.newGrid(this.cols, this.rows);
  }

  clearTileType(char) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === char) this.grid[r][c] = TILE.PATH;
      }
    }
  }

  // Loads a saved level's data into the working grid so it can be repainted
  // and re-tested, without touching editingId (callers decide whether this
  // is "edit an existing published level" or something else).
  loadLevelIntoEditor(level) {
    this.rows = level.grid.length;
    this.cols = level.grid[0].length;
    this.grid = level.grid.map((row) => row.split(''));
    this.hazards = (level.hazards || []).map((h) => ({ ...h }));
    this.cats = (level.cats || []).map((c) => ({ ...c }));
    this.zombies = (level.zombies || []).map((z) => ({ ...z }));
    this.creepers = (level.creepers || []).map((c) => ({ ...c }));
    this.hazardDraft = null;
    this.verified = false;
    this.verifiedSnapshot = null;

    this.nameInput.value = level.name || '';
    this.colsInput.value = String(this.cols);
    this.rowsInput.value = String(this.rows);
    const timeLimit = Number.isFinite(level.timeLimit) && level.timeLimit > 0 ? level.timeLimit : LEVEL_TIME;
    this.timerMinutesInput.value = String(Math.floor(timeLimit / 60));
    this.timerSecondsInput.value = String(timeLimit % 60);

    if (this.game.status === STATUS.EDITOR) {
      this.game.setCanvasSize(this.cols, this.rows);
    }
    this.clearError();
    this.renderEntityLists();
    this.updateWarning();
    this.onGridChanged();
  }

  // ---- Edit an already-published level ----

  handleEditLevel(entry) {
    this.loadLevelIntoEditor(entry.level);
    this.editingId = entry.id;
    this.positionInput.value = String(entry.position);
    this.editingIndicatorText.textContent = `Editing "${entry.level.name}" — Test Play then Publish to save your changes.`;
    this.updateEditingIndicator();
    this.renderMyLevels();
  }

  updateEditingIndicator() {
    if (this.editingId) {
      this.editingIndicator.classList.remove('hidden');
      this.publishBtn.textContent = 'Update';
    } else {
      this.editingIndicator.classList.add('hidden');
      this.publishBtn.textContent = 'Publish';
    }
  }

  // ---- Pointer handling ----

  cellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  handlePointerDown(e) {
    if (this.game.status !== STATUS.EDITOR) return;
    e.preventDefault();
    this.pointerActive = true;
    this.lastPaintedCell = null;
    const { col, row } = this.cellFromEvent(e);
    this.paintCell(col, row);
  }

  handlePointerMove(e) {
    if (this.game.status !== STATUS.EDITOR) return;
    if (!this.pointerActive) return;
    if (!DRAG_TOOLS.includes(this.currentTool)) return;
    e.preventDefault();
    const { col, row } = this.cellFromEvent(e);
    this.paintCell(col, row);
  }

  handlePointerUp() {
    this.pointerActive = false;
    this.lastPaintedCell = null;
  }

  paintCell(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    if (this.lastPaintedCell && this.lastPaintedCell.col === col && this.lastPaintedCell.row === row) return;
    this.lastPaintedCell = { col, row };
    this.applyTool(col, row);
  }

  applyTool(col, row) {
    const tool = this.currentTool;
    const current = this.grid[row][col];

    if (PAINT_CHARS[tool]) {
      if (current === TILE.START || current === TILE.EXIT) return;
      this.grid[row][col] = PAINT_CHARS[tool];
    } else if (tool === 'path') {
      this.grid[row][col] = TILE.PATH;
    } else if (tool === 'key') {
      if (current === TILE.START || current === TILE.EXIT) return;
      this.clearTileType(TILE.KEY);
      this.grid[row][col] = TILE.KEY;
    } else if (tool === 'start') {
      this.clearTileType(TILE.START);
      this.grid[row][col] = TILE.START;
    } else if (tool === 'exit') {
      this.clearTileType(TILE.EXIT);
      this.grid[row][col] = TILE.EXIT;
    } else if (tool === 'cat') {
      const idx = this.cats.findIndex((c) => c.col === col && c.row === row);
      if (idx >= 0) this.cats.splice(idx, 1);
      else this.cats.push({ col, row, speed: 105 });
      this.renderEntityLists();
    } else if (tool === 'zombie') {
      const idx = this.zombies.findIndex((z) => z.col === col && z.row === row);
      if (idx >= 0) this.zombies.splice(idx, 1);
      else this.zombies.push({ col, row, speed: 35 });
      this.renderEntityLists();
    } else if (tool === 'creeper') {
      const idx = this.creepers.findIndex((c) => c.col === col && c.row === row);
      if (idx >= 0) this.creepers.splice(idx, 1);
      else this.creepers.push({ col, row, speed: 44.1 });
      this.renderEntityLists();
    } else if (tool === 'hazard') {
      this.handleHazardClick(col, row);
      this.renderEntityLists();
    }

    this.updateWarning();
    this.onGridChanged();
  }

  handleHazardClick(col, row) {
    if (!this.hazardDraft) {
      this.hazardDraft = { col, row };
      return;
    }
    const { col: c1, row: r1 } = this.hazardDraft;
    const sameRow = r1 === row && c1 !== col;
    const sameCol = c1 === col && r1 !== row;
    if (sameRow || sameCol) {
      const distTiles = sameRow ? Math.abs(col - c1) : Math.abs(row - r1);
      const speed = Math.round((TARGET_HAZARD_PX_PER_SEC / (distTiles * TILE_SIZE)) * 100) / 100;
      this.hazards.push({ col: c1, row: r1, col2: col, row2: row, speed });
      this.hazardDraft = null;
    } else {
      this.hazardDraft = { col, row };
    }
  }

  // ---- Verification state ----

  getTimeLimitSeconds() {
    const minutes = Math.max(0, parseInt(this.timerMinutesInput.value, 10) || 0);
    const seconds = Math.max(0, parseInt(this.timerSecondsInput.value, 10) || 0);
    const total = minutes * 60 + seconds;
    // At least 5s (a level with no time at all can never be won) and cap at
    // 59:59 so it still fits the MM:SS HUD display.
    return Math.max(5, Math.min(3599, total || LEVEL_TIME));
  }

  snapshotKey() {
    return JSON.stringify({
      grid: this.grid.map((r) => r.join('')),
      hazards: this.hazards,
      cats: this.cats,
      zombies: this.zombies,
      creepers: this.creepers,
      timeLimit: this.getTimeLimitSeconds(),
    });
  }

  onGridChanged() {
    if (this.verified && this.snapshotKey() !== this.verifiedSnapshot) {
      this.verified = false;
    }
    this.publishBtn.disabled = !this.verified;
    this.statusText.textContent = this.verified
      ? '✓ Verified — ready to publish!'
      : 'Not tested yet — beat the level once to unlock Publish.';
  }

  markVerified() {
    this.verified = true;
    this.verifiedSnapshot = this.snapshotKey();
    this.onGridChanged();
  }

  validateStructure() {
    let startCount = 0;
    let exitCount = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === TILE.START) startCount++;
        if (this.grid[r][c] === TILE.EXIT) exitCount++;
      }
    }
    if (startCount !== 1) return { valid: false, reason: 'Place exactly one Start tile before testing.' };
    if (exitCount !== 1) return { valid: false, reason: 'Place exactly one Exit tile before testing.' };
    return { valid: true };
  }

  buildLevelData() {
    return {
      name: this.nameInput.value.trim() || 'Untitled Level',
      grid: this.grid.map((row) => row.join('')),
      hazards: this.hazards.map((h) => ({ ...h })),
      cats: this.cats.map((c) => ({ ...c })),
      zombies: this.zombies.map((z) => ({ ...z })),
      creepers: this.creepers.map((c) => ({ ...c })),
      timeLimit: this.getTimeLimitSeconds(),
    };
  }

  updateWarning() {
    const validation = this.validateStructure();
    if (!validation.valid) {
      this.warningEl.classList.add('hidden');
      return;
    }
    let parsed;
    try {
      parsed = parseLevel(this.buildLevelData());
    } catch (e) {
      this.warningEl.classList.add('hidden');
      return;
    }
    const { exitReachable, keyReachable } = checkReachability(parsed);
    const problems = [];
    if (!keyReachable) problems.push('the key looks unreachable');
    if (!exitReachable) problems.push('the exit looks unreachable');
    if (problems.length) {
      this.warningEl.textContent = `⚠ Heads up: ${problems.join(' and ')}.`;
      this.warningEl.classList.remove('hidden');
    } else {
      this.warningEl.classList.add('hidden');
    }
  }

  showError(msg) {
    this.errorEl.textContent = msg;
    this.errorEl.classList.remove('hidden');
  }

  clearError() {
    this.errorEl.classList.add('hidden');
  }

  // ---- Test play / publish ----

  handleTestPlay() {
    const validation = this.validateStructure();
    if (!validation.valid) {
      this.showError(validation.reason);
      return;
    }
    this.clearError();
    const levelData = this.buildLevelData();
    this.game.startCustomLevel(levelData, (success) => {
      if (success) this.markVerified();
      this.showEditorScreen();
    });
  }

  handlePublish() {
    if (!this.verified) return;
    const levelData = this.buildLevelData();
    const combined = getCombinedLevels();
    // Publishing an update to an existing level shouldn't count its own
    // current slot when clamping the requested position.
    const maxPosition = this.editingId ? combined.length : combined.length + 1;
    let position = parseInt(this.positionInput.value, 10);
    if (!Number.isFinite(position) || position < 1) position = maxPosition;
    position = Math.min(position, maxPosition);
    saveCustomLevel(levelData, position, this.editingId);
    this.editingId = null;
    this.updateEditingIndicator();
    this.renderMyLevels();
    this.positionInput.value = String(getCombinedLevels().length + 1);
    this.game.goToMenu();
  }

  // ---- Backup / transfer ----

  showTransferStatus(msg) {
    this.transferStatus.textContent = msg;
    this.transferStatus.classList.remove('hidden');
  }

  async handleExport() {
    const blob = exportCustomLevels();
    this.transferTextarea.value = blob;
    this.transferTextarea.classList.remove('hidden');
    this.transferTextarea.focus();
    this.transferTextarea.select();

    const count = loadCustomLevels().length;
    if (count === 0) {
      this.showTransferStatus("You haven't published any levels yet -- nothing to export.");
      return;
    }

    try {
      await navigator.clipboard.writeText(blob);
      this.showTransferStatus(`Copied ${count} level${count === 1 ? '' : 's'} to your clipboard (also shown below).`);
    } catch (e) {
      this.showTransferStatus(`${count} level${count === 1 ? '' : 's'} ready below -- select the text and copy it manually.`);
    }
  }

  handleImport() {
    this.transferTextarea.classList.remove('hidden');
    const text = this.transferTextarea.value.trim();
    if (!text) {
      this.showTransferStatus('Paste an exported level blob into the box first, then click Import.');
      return;
    }

    const result = importCustomLevels(text);
    if (!result.ok) {
      this.showTransferStatus(result.error);
      return;
    }

    this.renderMyLevels();
    this.positionInput.value = String(getCombinedLevels().length + 1);
    const parts = [`Imported ${result.imported} level${result.imported === 1 ? '' : 's'}.`];
    if (result.skipped > 0) parts.push(`Skipped ${result.skipped} that didn't look valid.`);
    this.showTransferStatus(parts.join(' '));
  }

  // ---- Lists ----

  renderEntityLists() {
    this.hazardListEl.innerHTML = '';
    this.hazards.forEach((hz, i) => {
      const row = document.createElement('div');
      row.className = 'editor-entity-row';

      const label = document.createElement('span');
      const distTiles = hz.col === hz.col2 ? Math.abs(hz.row2 - hz.row) : Math.abs(hz.col2 - hz.col);
      const pxPerSec = Math.round(hz.speed * distTiles * TILE_SIZE);
      label.textContent = `(${hz.col},${hz.row})→(${hz.col2},${hz.row2}) ~${pxPerSec}px/s`;

      const speedInput = document.createElement('input');
      speedInput.type = 'number';
      speedInput.step = '0.01';
      speedInput.min = '0.01';
      speedInput.value = hz.speed;
      speedInput.addEventListener('change', () => {
        const v = parseFloat(speedInput.value);
        if (Number.isFinite(v) && v > 0) {
          this.hazards[i].speed = v;
          this.onGridChanged();
          this.renderEntityLists();
        }
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        this.hazards.splice(i, 1);
        this.onGridChanged();
        this.renderEntityLists();
      });

      row.append(label, speedInput, delBtn);
      this.hazardListEl.appendChild(row);
    });
    if (this.hazards.length === 0) {
      this.hazardListEl.innerHTML = '<p class="editor-hint">None placed.</p>';
    }

    this.catListEl.innerHTML = '';
    this.cats.forEach((cat, i) => {
      const row = document.createElement('div');
      row.className = 'editor-entity-row';

      const label = document.createElement('span');
      label.textContent = `(${cat.col},${cat.row})`;

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        this.cats.splice(i, 1);
        this.onGridChanged();
        this.renderEntityLists();
      });

      row.append(label, delBtn);
      this.catListEl.appendChild(row);
    });
    if (this.cats.length === 0) {
      this.catListEl.innerHTML = '<p class="editor-hint">None placed.</p>';
    }

    this.zombieListEl.innerHTML = '';
    this.zombies.forEach((zombie, i) => {
      const row = document.createElement('div');
      row.className = 'editor-entity-row';

      const label = document.createElement('span');
      label.textContent = `(${zombie.col},${zombie.row})`;

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        this.zombies.splice(i, 1);
        this.onGridChanged();
        this.renderEntityLists();
      });

      row.append(label, delBtn);
      this.zombieListEl.appendChild(row);
    });
    if (this.zombies.length === 0) {
      this.zombieListEl.innerHTML = '<p class="editor-hint">None placed.</p>';
    }

    this.creeperListEl.innerHTML = '';
    this.creepers.forEach((creeper, i) => {
      const row = document.createElement('div');
      row.className = 'editor-entity-row';

      const label = document.createElement('span');
      label.textContent = `(${creeper.col},${creeper.row})`;

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        this.creepers.splice(i, 1);
        this.onGridChanged();
        this.renderEntityLists();
      });

      row.append(label, delBtn);
      this.creeperListEl.appendChild(row);
    });
    if (this.creepers.length === 0) {
      this.creeperListEl.innerHTML = '<p class="editor-hint">None placed.</p>';
    }
  }

  renderMyLevels() {
    const entries = loadCustomLevels();
    this.myLevelsList.innerHTML = '';
    if (entries.length === 0) {
      this.myLevelsList.innerHTML = '<p class="editor-hint">No published levels yet.</p>';
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'editor-entity-row';
      if (entry.id === this.editingId) row.classList.add('editing');

      const label = document.createElement('span');
      label.textContent = `#${entry.position} ${entry.level.name}`;

      const editBtn = document.createElement('button');
      editBtn.textContent = entry.id === this.editingId ? 'Editing…' : 'Edit';
      editBtn.addEventListener('click', () => this.handleEditLevel(entry));

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        deleteCustomLevel(entry.id);
        if (entry.id === this.editingId) {
          this.editingId = null;
          this.updateEditingIndicator();
        }
        this.renderMyLevels();
      });

      row.append(label, editBtn, delBtn);
      this.myLevelsList.appendChild(row);
    }
  }

  // ---- Screen lifecycle / rendering ----

  showEditorScreen() {
    this.game.goToEditor();
    this.game.setCanvasSize(this.cols, this.rows);
    this.renderEntityLists();
    this.renderMyLevels();
    this.updateWarning();
    this.onGridChanged();
    this.startRenderLoop();
  }

  startRenderLoop() {
    const loop = (time) => {
      if (this.game.status !== STATUS.EDITOR) return;
      this.render(time / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render(time) {
    let parsed;
    try {
      parsed = parseLevel(this.buildLevelData());
    } catch (e) {
      return;
    }
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    drawMaze(ctx, parsed, parsed.rocks, time || 0, 0, 0);

    // Start marker -- parseLevel erases 'S' to plain path, so drawMaze never
    // draws it; everything else (walls/mud/water/key/gate/exit) it already
    // handles from the grid.
    const sx = parsed.start.col * TILE_SIZE + TILE_SIZE / 2;
    const sy = parsed.start.row * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillStyle = '#66bb6a';
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d2b12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', sx, sy);

    ctx.strokeStyle = 'rgba(229, 57, 53, 0.75)';
    ctx.lineWidth = 3;
    for (const hz of this.hazards) {
      const x1 = hz.col * TILE_SIZE + TILE_SIZE / 2;
      const y1 = hz.row * TILE_SIZE + TILE_SIZE / 2;
      const x2 = hz.col2 * TILE_SIZE + TILE_SIZE / 2;
      const y2 = hz.row2 * TILE_SIZE + TILE_SIZE / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.arc(x1, y1, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y2, 6, 0, Math.PI * 2); ctx.fill();
    }

    if (this.hazardDraft) {
      const x = this.hazardDraft.col * TILE_SIZE + TILE_SIZE / 2;
      const y = this.hazardDraft.row * TILE_SIZE + TILE_SIZE / 2;
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffb74d';
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 1.5;
    for (const cat of this.cats) {
      const x = cat.col * TILE_SIZE + TILE_SIZE / 2;
      const y = cat.row * TILE_SIZE + TILE_SIZE / 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#4c8a3f';
    ctx.strokeStyle = '#0b0b0b';
    ctx.lineWidth = 1.5;
    for (const zombie of this.zombies) {
      const x = zombie.col * TILE_SIZE + TILE_SIZE / 2;
      const y = zombie.row * TILE_SIZE + TILE_SIZE / 2;
      ctx.beginPath();
      ctx.roundRect(x - 8, y - 8, 16, 16, 3);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#5fae44';
    ctx.strokeStyle = '#2f6621';
    ctx.lineWidth = 1.5;
    for (const creeper of this.creepers) {
      const x = creeper.col * TILE_SIZE + TILE_SIZE / 2;
      const y = creeper.row * TILE_SIZE + TILE_SIZE / 2;
      ctx.beginPath();
      ctx.roundRect(x - 6, y - 9, 12, 18, 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
