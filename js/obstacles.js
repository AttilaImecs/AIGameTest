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
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hugDist = this.radius + player.radius;
    const proximityDist = hugDist + 24;
    const overlapping = dist < hugDist;
    const nearby = dist < proximityDist;

    if (overlapping) {
      this.hugging = true;
      this.heartTimer += dt;
      if (this.heartTimer >= HEART_SPAWN_INTERVAL) {
        this.heartTimer = 0;
        this.hearts.push({ x: this.x + (Math.random() - 0.5) * 16, y: this.y - 10, age: 0 });
      }
    } else {
      this.hugging = false;
      if (nearby) {
        this.heartTimer += dt;
        if (this.heartTimer >= HEART_SPAWN_INTERVAL * 2) {
          this.heartTimer = 0;
          this.hearts.push({ x: this.x + (Math.random() - 0.5) * 12, y: this.y - 8, age: 0 });
        }
      } else {
        this.heartTimer = HEART_SPAWN_INTERVAL * 2;
      }
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

    const bob = this.hugging ? Math.sin(time * 6) * 1 : 0;
    ctx.translate(0, bob);

    const FUR = '#ffb74d';
    const FUR_DARK = '#e65100';
    const FUR_LIGHT = '#fff3e0';

    // tail, curling behind
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.moveTo(-11, -1);
    ctx.quadraticCurveTo(-20, -6, -17, -13);
    ctx.quadraticCurveTo(-15, -6, -10, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 1;
    ctx.stroke();

    // body, smaller, trailing behind the head
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(-7, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // ears (drawn before the head so only the tips poke out)
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.moveTo(1, -8); ctx.lineTo(3, -16); ctx.lineTo(7, -9);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, 8); ctx.lineTo(3, 16); ctx.lineTo(7, 9);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffccbc';
    ctx.beginPath();
    ctx.moveTo(2.5, -9.5); ctx.lineTo(3.5, -13.5); ctx.lineTo(5.5, -10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.5, 9.5); ctx.lineTo(3.5, 13.5); ctx.lineTo(5.5, 10);
    ctx.closePath(); ctx.fill();

    // head: big and round for chibi/cute proportions
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.arc(4, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // muzzle highlight
    ctx.fillStyle = FUR_LIGHT;
    ctx.beginPath();
    ctx.ellipse(8, 1, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // big eyes with a highlight dot
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(6, -4, 2.6, 0, Math.PI * 2);
    ctx.arc(6, 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(6.8, -4.8, 0.9, 0, Math.PI * 2);
    ctx.arc(6.8, 3.2, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // pink nose
    ctx.fillStyle = '#f8607a';
    ctx.beginPath();
    ctx.moveTo(11, -1.3); ctx.lineTo(11, 1.3); ctx.lineTo(13, 0);
    ctx.closePath();
    ctx.fill();

    // whiskers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(9, -2); ctx.lineTo(16, -4);
    ctx.moveTo(9.5, 0); ctx.lineTo(17, 0);
    ctx.moveTo(9, 2); ctx.lineTo(16, 4);
    ctx.stroke();

    // upturned smile
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(9.5, -1, 2, 0.4, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9.5, 1, 2, -Math.PI * 0.8, -0.4, true);
    ctx.stroke();

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
