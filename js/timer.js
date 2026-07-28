export const LEVEL_TIME = 180;
export const WARNING_THRESHOLD = 30;

export class Timer {
  constructor(seconds = LEVEL_TIME) {
    this.remaining = seconds;
    this.running = false;
  }

  reset(seconds = LEVEL_TIME) {
    this.remaining = seconds;
    this.running = false;
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  update(dt) {
    if (!this.running) return;
    this.remaining = Math.max(0, this.remaining - dt);
  }

  isExpired() {
    return this.remaining <= 0;
  }

  isWarning() {
    return this.remaining <= WARNING_THRESHOLD && this.remaining > 0;
  }

  format() {
    const total = Math.ceil(this.remaining);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
