import { TILE_SIZE, TILE, getTile, isSolidTile } from './maze.js';

const BASE_SPEED = 120;
const SLOW_SPEED = 70;
const PLAYER_RADIUS = 10;
const SLIME_TRAIL_LENGTH = 9;

export class Player {
  constructor(startCol, startRow) {
    this.reset(startCol, startRow);
    this.bobPhase = 0;
    this.facing = { x: 1, y: 0 };
  }

  reset(startCol, startRow) {
    this.x = startCol * TILE_SIZE + TILE_SIZE / 2;
    this.y = startRow * TILE_SIZE + TILE_SIZE / 2;
    this.hasKey = false;
    this.slimeTrail = [];
    this.lastTile = null;
    this.bobPhase = 0;
  }

  get radius() {
    return PLAYER_RADIUS;
  }

  getTileCoords() {
    return {
      col: Math.floor(this.x / TILE_SIZE),
      row: Math.floor(this.y / TILE_SIZE),
    };
  }

  update(input, level, rocks, dt) {
    let dx = 0;
    let dy = 0;

    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    if (dx === 0 && dy === 0) return { pushedRock: false };

    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;

    this.facing = { x: dx, y: dy };

    const { col, row } = this.getTileCoords();
    const onMud = getTile(level, col, row) === TILE.MUD;
    let speed = input.slow ? SLOW_SPEED : BASE_SPEED;
    if (onMud) speed *= 0.5;

    const moveX = dx * speed * dt;
    const moveY = dy * speed * dt;

    const newX = this.x + moveX;
    const newY = this.y + moveY;

    const resolved = this.resolveMovement(this.x, this.y, newX, newY, level, rocks);

    this.x = resolved.x;
    this.y = resolved.y;
    this.bobPhase += dt * 8;

    const currentTile = this.getTileCoords();
    if (!this.lastTile || currentTile.col !== this.lastTile.col || currentTile.row !== this.lastTile.row) {
      if (this.lastTile) {
        this.slimeTrail.unshift({ col: this.lastTile.col, row: this.lastTile.row });
        if (this.slimeTrail.length > SLIME_TRAIL_LENGTH) this.slimeTrail.pop();
      }
      this.lastTile = currentTile;
    }

    return { pushedRock: resolved.pushedRock };
  }

  resolveMovement(oldX, oldY, newX, newY, level, rocks) {
    let x = newX;
    let y = oldY;
    let pushedRock = false;

    const xResult = this.checkAxis(oldX, oldY, x, y, level, rocks, 'x');
    x = xResult.pos;
    pushedRock = xResult.pushedRock;

    const yResult = this.checkAxis(x, oldY, x, newY, level, rocks, 'y');
    y = yResult.pos;
    if (yResult.pushedRock) pushedRock = true;

    return { x, y, pushedRock };
  }

  checkAxis(startX, startY, targetX, targetY, level, rocks, axis) {
    const r = this.radius;
    let pos = axis === 'x' ? targetX : targetY;
    const other = axis === 'x' ? startY : startX;
    let pushedRock = false;

    const testPoints = axis === 'x'
      ? [
          { x: pos - r, y: other - r },
          { x: pos + r, y: other - r },
          { x: pos - r, y: other + r },
          { x: pos + r, y: other + r },
        ]
      : [
          { x: other - r, y: pos - r },
          { x: other + r, y: pos - r },
          { x: other - r, y: pos + r },
          { x: other + r, y: pos + r },
        ];

    for (const point of testPoints) {
      const col = Math.floor(point.x / TILE_SIZE);
      const row = Math.floor(point.y / TILE_SIZE);
      const tile = getTile(level, col, row);

      if (isSolidTile(tile, this.hasKey)) {
        return { pos: axis === 'x' ? startX : startY, pushedRock: false };
      }

      const rock = rocks.find((rk) => rk.col === col && rk.row === row);
      if (rock) {
        const pushCol = col + (axis === 'x' ? Math.sign(targetX - startX) : 0);
        const pushRow = row + (axis === 'y' ? Math.sign(targetY - startY) : 0);
        const pushTile = getTile(level, pushCol, pushRow);
        const rockAtDest = rocks.find((rk) => rk.col === pushCol && rk.row === pushRow);

        if (
          !isSolidTile(pushTile, this.hasKey) &&
          pushTile !== TILE.WATER &&
          !rockAtDest
        ) {
          rock.col = pushCol;
          rock.row = pushRow;
          pushedRock = true;
        } else {
          return { pos: axis === 'x' ? startX : startY, pushedRock: false };
        }
      }
    }

    return { pos, pushedRock };
  }

  isOnTile(level, tileType) {
    const { col, row } = this.getTileCoords();
    return getTile(level, col, row) === tileType;
  }

  isAtExit(level) {
    const { col, row } = this.getTileCoords();
    return getTile(level, col, row) === TILE.EXIT;
  }

  collectKey(level) {
    const { col, row } = this.getTileCoords();
    if (getTile(level, col, row) === TILE.KEY) {
      level.grid[row][col] = TILE.PATH;
      this.hasKey = true;
      return true;
    }
    return false;
  }

  draw(ctx, time) {
    for (let i = 0; i < this.slimeTrail.length; i++) {
      const t = this.slimeTrail[i];
      const alpha = 0.5 * (1 - i / SLIME_TRAIL_LENGTH);
      if (alpha <= 0) continue;
      const tx = t.col * TILE_SIZE, ty = t.row * TILE_SIZE;
      ctx.fillStyle = `rgba(46, 74, 30, ${alpha.toFixed(3)})`;
      ctx.fillRect(tx + 3, ty + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }

    const bob = Math.sin(this.bobPhase) * 1.5;

    ctx.save();
    ctx.translate(this.x, this.y + bob);

    const angle = Math.atan2(this.facing.y, this.facing.x);
    ctx.rotate(angle);

    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.moveTo(-13, -5);
    ctx.quadraticCurveTo(-25, -2, -27, 0);
    ctx.quadraticCurveTo(-25, 2, -13, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#a1887f';
    ctx.beginPath();
    ctx.arc(-3, -3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-3, -3, 4.5, 0.3, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-1.5, -3.5, 2.2, 0.5, Math.PI * 1.8);
    ctx.stroke();

    const eyeWiggle = Math.sin(time * 4) * 2;
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(10, -10 + eyeWiggle);
    ctx.moveTo(6, 4);
    ctx.lineTo(10, 8 + eyeWiggle);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(10, -10 + eyeWiggle, 3, 0, Math.PI * 2);
    ctx.arc(10, 8 + eyeWiggle, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(11, -10 + eyeWiggle, 1.5, 0, Math.PI * 2);
    ctx.arc(11, 8 + eyeWiggle, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class Input {
  constructor() {
    this.keys = {};
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;
    this.slow = false;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  onKey(e, pressed) {
    this.keys[e.code] = pressed;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    this.up = this.keys['ArrowUp'] || this.keys['KeyW'];
    this.down = this.keys['ArrowDown'] || this.keys['KeyS'];
    this.left = this.keys['ArrowLeft'] || this.keys['KeyA'];
    this.right = this.keys['ArrowRight'] || this.keys['KeyD'];
    this.slow = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
  }
}
