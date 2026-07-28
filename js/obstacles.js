import { TILE_SIZE } from './maze.js';

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

  update(dt) {
    this.progress += this.speed * dt * this.direction;
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
