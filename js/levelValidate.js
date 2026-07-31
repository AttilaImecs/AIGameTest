// Non-blocking sanity check for the level editor. Uses the same BFS
// technique proven out on Level 7 this session: walls and locked gates are
// solid, and rock tiles are treated as permanently blocking (this is a
// static check, it doesn't simulate pushing). A level that only works by
// pushing a rock out of the way will show as "unreachable" here even though
// it's fine -- that's expected, not a bug. It's a heads-up, not the real
// gate; the real gate is beating it via Test Play.

import { getTile, isSolidTile, TILE } from './maze.js';

function bfsReachable(level, hasKey) {
  const { cols, rows, start } = level;
  const rockSet = new Set(level.rocks.map((r) => `${r.col},${r.row}`));
  const dist = Array.from({ length: rows }, () => new Array(cols).fill(-1));

  if (start.row < 0 || start.row >= rows || start.col < 0 || start.col >= cols) {
    return dist;
  }

  dist[start.row][start.col] = 0;
  const queue = [[start.col, start.row]];
  let head = 0;
  while (head < queue.length) {
    const [c, r] = queue[head++];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      if (dist[nr][nc] !== -1) continue;
      const tile = getTile(level, nc, nr);
      if (isSolidTile(tile, hasKey)) continue;
      if (rockSet.has(`${nc},${nr}`)) continue;
      dist[nr][nc] = dist[r][c] + 1;
      queue.push([nc, nr]);
    }
  }
  return dist;
}

// Takes a PARSED level (the output of maze.js's parseLevel).
export function checkReachability(level) {
  const distNoKey = bfsReachable(level, false);

  let keyReachable = !level.hasKeyOnMap;
  if (level.hasKeyOnMap) {
    keyReachable = false;
    outer:
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (level.grid[r][c] === TILE.KEY) {
          keyReachable = distNoKey[r][c] !== -1;
          break outer;
        }
      }
    }
  }

  const distWithKey = bfsReachable(level, true);
  const exitReachable = !!(
    level.exit &&
    distWithKey[level.exit.row] &&
    distWithKey[level.exit.row][level.exit.col] !== -1
  );

  return { exitReachable, keyReachable };
}
