import { TILE_SIZE, getTile, isSolidTile } from './maze.js';

export class MovingHazard {
  constructor(config) {
    this.x = config.col * TILE_SIZE + TILE_SIZE / 2;
    this.y = config.row * TILE_SIZE + TILE_SIZE / 2;
    this.x2 = config.col2 * TILE_SIZE + TILE_SIZE / 2;
    this.y2 = config.row2 * TILE_SIZE + TILE_SIZE / 2;
    this.speed = config.speed || 1.5;
    this.radius = TILE_SIZE * 0.35;
    this.progress = 0;
    this.direction = 1;
  }

  update(dt, rocks = []) {
    const nextProgress = Math.max(0, Math.min(1, this.progress + this.speed * dt * this.direction));
    const nextX = this.x + (this.x2 - this.x) * nextProgress;
    const nextY = this.y + (this.y2 - this.y) * nextProgress;
    const col = Math.floor(nextX / TILE_SIZE);
    const row = Math.floor(nextY / TILE_SIZE);

    if (rocks.some((r) => r.col === col && r.row === row)) {
      this.direction *= -1;
      return;
    }

    this.progress = nextProgress;
    if (this.progress >= 1) {
      this.progress = 1;
      this.direction = -1;
    } else if (this.progress <= 0) {
      this.progress = 0;
      this.direction = 1;
    }
  }

  getPosition() {
    return {
      x: this.x + (this.x2 - this.x) * this.progress,
      y: this.y + (this.y2 - this.y) * this.progress,
    };
  }

  collidesWith(px, py, pr) {
    const pos = this.getPosition();
    const dx = px - pos.x;
    const dy = py - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.radius + pr;
  }

  draw(ctx, time) {
    const pos = this.getPosition();
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b71c1c';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(pos.x - 4, pos.y - 2, 3, 0, Math.PI * 2);
    ctx.arc(pos.x + 4, pos.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(pos.x - 4, pos.y - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(pos.x + 4, pos.y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    const pulse = 0.3 + Math.sin(time * 5) * 0.15;
    ctx.strokeStyle = `rgba(229, 57, 53, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function createHazards(hazardConfigs) {
  return hazardConfigs.map((config) => new MovingHazard(config));
}

const CAT_REPATH_INTERVAL = 0.4;
const HEART_SPAWN_INTERVAL = 0.35;
const HEART_LIFETIME = 1.0;

// Friendly, never fails the level -- purely a cosmetic chase-and-hug character.
export class ChasingCat {
  constructor(config) {
    this.x = config.col * TILE_SIZE + TILE_SIZE / 2;
    this.y = config.row * TILE_SIZE + TILE_SIZE / 2;
    this.speed = config.speed || 35;
    this.radius = TILE_SIZE * 0.35;
    this.repathTimer = 0;
    this.distanceField = null;
    this.hugging = false;
    this.heartTimer = 0;
    this.hearts = [];
    this.facing = { x: -1, y: 0 };
  }

  computeDistanceField(level, rocks, player) {
    const { cols, rows } = level;
    const dist = Array.from({ length: rows }, () => new Array(cols).fill(-1));
    const startCol = Math.floor(player.x / TILE_SIZE);
    const startRow = Math.floor(player.y / TILE_SIZE);
    if (startRow < 0 || startRow >= rows || startCol < 0 || startCol >= cols) return dist;

    const isBlocked = (col, row) => {
      const tile = getTile(level, col, row);
      if (isSolidTile(tile, player.hasKey)) return true;
      return rocks.some((r) => r.col === col && r.row === row);
    };

    dist[startRow][startCol] = 0;
    const queue = [[startCol, startRow]];
    let head = 0;
    while (head < queue.length) {
      const [col, row] = queue[head++];
      const d = dist[row][col];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (dist[nr][nc] !== -1) continue;
        if (isBlocked(nc, nr)) continue;
        dist[nr][nc] = d + 1;
        queue.push([nc, nr]);
      }
    }
    return dist;
  }

  moveToward(dt, level) {
    const { cols, rows } = level;
    const curCol = Math.floor(this.x / TILE_SIZE);
    const curRow = Math.floor(this.y / TILE_SIZE);
    const curDist = this.distanceField[curRow] && this.distanceField[curRow][curCol];
    if (curDist == null || curDist < 0) return;

    let best = null;
    let bestDist = curDist;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = curRow + dr, nc = curCol + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const d = this.distanceField[nr][nc];
      if (d >= 0 && d < bestDist) {
        bestDist = d;
        best = { col: nc, row: nr };
      }
    }
    if (!best) return;

    const targetX = best.col * TILE_SIZE + TILE_SIZE / 2;
    const targetY = best.row * TILE_SIZE + TILE_SIZE / 2;
    const dx = targetX - this.x, dy = targetY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.facing = { x: dx / len, y: dy / len };
    const moveDist = this.speed * dt;
    if (moveDist >= len) {
      this.x = targetX;
      this.y = targetY;
    } else {
      this.x += (dx / len) * moveDist;
      this.y += (dy / len) * moveDist;
    }
  }

  update(dt, level, rocks, player) {
    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || !this.distanceField) {
      this.distanceField = this.computeDistanceField(level, rocks, player);
      this.repathTimer = CAT_REPATH_INTERVAL;
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const overlapping = Math.sqrt(dx * dx + dy * dy) < this.radius + player.radius;

    if (overlapping) {
      this.hugging = true;
      this.heartTimer += dt;
      if (this.heartTimer >= HEART_SPAWN_INTERVAL) {
        this.heartTimer = 0;
        this.hearts.push({ x: this.x + (Math.random() - 0.5) * 16, y: this.y - 10, age: 0 });
      }
    } else {
      this.hugging = false;
      this.moveToward(dt, level);
    }

    for (const h of this.hearts) h.age += dt;
    this.hearts = this.hearts.filter((h) => h.age < HEART_LIFETIME);
  }

  draw(ctx, time) {
    for (const h of this.hearts) {
      const t = h.age / HEART_LIFETIME;
      const alpha = Math.max(0, 1 - t);
      const riseY = h.y - t * 20;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ff6f91';
      drawHeart(ctx, h.x, riseY, 5 + t * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.facing.y, this.facing.x);
    ctx.rotate(angle);

    ctx.fillStyle = '#90a4ae';
    ctx.beginPath();
    ctx.moveTo(-9, -2);
    ctx.quadraticCurveTo(-16, -6, -14, -10);
    ctx.quadraticCurveTo(-12, -5, -8, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#90a4ae';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(4, -7); ctx.lineTo(8, -13); ctx.lineTo(9, -5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, 7); ctx.lineTo(8, 13); ctx.lineTo(9, 5);
    ctx.closePath();
    ctx.fill();

    const bob = this.hugging ? Math.sin(time * 6) * 1 : 0;
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(6, -3 + bob, 1.4, 0, Math.PI * 2);
    ctx.arc(6, 3 + bob, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawHeart(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.3);
  ctx.bezierCurveTo(cx, cy, cx - size, cy, cx - size, cy + size * 0.3);
  ctx.bezierCurveTo(cx - size, cy + size * 0.7, cx, cy + size, cx, cy + size * 1.2);
  ctx.bezierCurveTo(cx, cy + size, cx + size, cy + size * 0.7, cx + size, cy + size * 0.3);
  ctx.bezierCurveTo(cx + size, cy, cx, cy, cx, cy + size * 0.3);
  ctx.fill();
}

export function createCats(catConfigs) {
  return (catConfigs || []).map((config) => new ChasingCat(config));
}
