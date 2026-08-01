export const TILE_SIZE = 32;

export const TILE = {
  WALL: '#',
  PATH: '.',
  START: 'S',
  EXIT: 'E',
  MUD: 'M',
  WATER: 'W',
  KEY: 'K',
  GATE: 'G',
  ROCK: 'R',
};

export const COLORS = {
  wall: '#1b4332',
  wallEdge: '#081c15',
  path: '#52b788',
  mud: '#6d4c2a',
  water: '#2196f3',
  gate: '#795548',
  exit: '#66bb6a',
  exitGlow: 'rgba(102, 187, 106, 0.4)',
  key: '#ffd54f',
  rock: '#78909c',
};

export const LEVELS = [
  {
    name: 'Garden Path',
    grid: [
      '####################',
      '#S.................#',
      '#.####.#####.#####.#',
      '#....MM...MM.......#',
      '#.####.#####.#####.#',
      '#......MM..........#',
      '#.####.#####.#####.#',
      '#..................#',
      '#.####.#####.#####.#',
      '#..................E',
      '####################',
    ],
    hazards: [],
  },
  {
    name: 'Rainy Garden',
    grid: [
      '####################',
      '#S...W.............#',
      '#.##.####.####.###.#',
      '#....W....W........#',
      '#.##.####.####.###.#',
      '#......W....W......#',
      '#.##.####.####.###.#',
      '#............W.....E',
      '####################',
    ],
    hazards: [],
  },
  {
    name: 'Locked Gate',
    grid: [
      '#################',
      '#S..............#',
      '#...#...........#',
      '###.#####.###.###',
      '#.#.#...#...#...#',
      '#.#.#.#.#######.#',
      '#.#...#...#.....#',
      '#.#######.#.#####',
      '#.......#.#.....#',
      '#.###.###.#####.#',
      '#.#K#...#.......#',
      '#.#.###.#######.#',
      '#.....#.........#',
      '###############G#',
      '#...............E',
      '#################',
    ],
    hazards: [],
    cats: [
      { col: 7, row: 6, speed: 105 },
    ],
  },
  {
    name: 'Rocky Trail',
    grid: [
      '####################',
      '#S.................#',
      '######R#############',
      '#..R...........R...#',
      '#.####.#####.#####.#',
      '#..................#',
      '############R#######',
      '#..................#',
      '#........R.........E',
      '####################',
    ],
    hazards: [],
    cats: [
      { col: 13, row: 1, speed: 105 },
    ],
  },
  {
    name: 'Final Gauntlet',
    grid: [
      '######################',
      '#S....M....W.........#',
      '#.##.####.####.#####.#',
      '#....K..R....M...W...#',
      '#.##.####.####.#####.#',
      '#....M..R....W..M....#',
      '##############G#######',
      '#..M....W...........E#',
      '######################',
    ],
    hazards: [
      { col: 9, row: 5, col2: 18, row2: 5, speed: 1.5 },
    ],
    cats: [
      { col: 12, row: 5, speed: 105 },
    ],
  },
  {
    name: "Daniel's Cats",
    grid: [
      '#####################',
      '#S###################',
      '#.....#.....#..W#...#',
      '#####.#.###.###M#.#.#',
      '#..M#.#.#.....#.M.#.#',
      '#.###.#.#####.#####.#',
      '#.#...#...#.........#',
      '#.#.###.#.#########.#',
      '#.#.#K.R#...#.....#.#',
      '#.#.###.###.#.###.#.#',
      '#.#...#..M#.#.#W#.#.#',
      '#.###.#####.#.#.#.#.#',
      '#..WW.......#...#...#',
      '###############G#####',
      '#...................E',
      '#####################',
    ],
    hazards: [
      { col: 1, row: 14, col2: 19, row2: 14, speed: 0.73 },
      { col: 1, row: 4, col2: 1, row2: 12, speed: 1.64 },
    ],
    cats: [
      { col: 10, row: 4, speed: 105 },
      { col: 19, row: 4, speed: 105 },
      { col: 6, row: 12, speed: 105 },
    ],
  },
  {
    name: 'Shell Shock',
    grid: [
      '#######################',
      '#S....................#',
      '########R##############',
      '#.....................#',
      '#.....................#',
      '##############R########',
      '#.....................#',
      '#.###.................#',
      '#.#####################',
      '#.#.......#.........#W#',
      '#.###.#.#G#.#######.#.#',
      '#...#.#.#...#.....#...#',
      '###.#.#.#####.###.###M#',
      '#.#.#.#...#.#.#..M#...#',
      '#.#.###.#.#.#.#.###.###',
      '#.#...#K#.#...#...#...#',
      '#.###.###.#.#####.###.#',
      '#....M#...#..M#...#...#',
      '#.#####.#####.#.#.#.###',
      '#.#.M...#.....#.#.#.#.#',
      '#.#.#####G#####.###.#.#',
      '#...#.....#...#.....#.#',
      '#####.#######.#######.#',
      '#W.............M......E',
      '#######################',
    ],
    hazards: [
      { col: 5, row: 1, col2: 16, row2: 1, speed: 0.25 },
      { col: 5, row: 3, col2: 16, row2: 3, speed: 0.25 },
      { col: 8, row: 7, col2: 19, row2: 7, speed: 0.25 },
    ],
    cats: [
      { col: 5, row: 19, speed: 105 },
      { col: 17, row: 11, speed: 105 },
      { col: 11, row: 17, speed: 105 },
      { col: 13, row: 23, speed: 105 },
    ],
  },
];

export function parseLevel(levelData) {
  const grid = levelData.grid.map((row) => row.split(''));
  let start = { col: 0, row: 0 };
  let exit = { col: 0, row: 0 };
  const rocks = [];
  let hasKeyOnMap = false;

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const tile = grid[row][col];
      if (tile === TILE.START) {
        start = { col, row };
        grid[row][col] = TILE.PATH;
      } else if (tile === TILE.EXIT) {
        exit = { col, row };
      } else if (tile === TILE.ROCK) {
        rocks.push({ col, row });
        grid[row][col] = TILE.PATH;
      } else if (tile === TILE.KEY) {
        hasKeyOnMap = true;
      }
    }
  }

  return {
    name: levelData.name,
    grid,
    start,
    exit,
    rocks,
    hasKeyOnMap,
    hazards: levelData.hazards.map((h) => ({ ...h })),
    cats: (levelData.cats || []).map((c) => ({ ...c })),
    zombies: (levelData.zombies || []).map((z) => ({ ...z })),
    creepers: (levelData.creepers || []).map((c) => ({ ...c })),
    cols: grid[0].length,
    rows: grid.length,
  };
}

export function getTile(level, col, row) {
  if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) {
    return TILE.WALL;
  }
  return level.grid[row][col];
}

export function isSolidTile(tile, hasKey) {
  if (tile === TILE.WALL) return true;
  if (tile === TILE.GATE && !hasKey) return true;
  return false;
}

export function drawMaze(ctx, level, rocks, time, doorProgress = 0, gateProgress = 0) {
  const { cols, rows } = level;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = level.grid[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      if (tile === TILE.WALL) {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = COLORS.wallEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      } else {
        ctx.fillStyle = COLORS.path;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        if (tile === TILE.MUD) {
          ctx.fillStyle = COLORS.mud;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.globalAlpha = 1;
        } else if (tile === TILE.WATER) {
          ctx.fillStyle = COLORS.water;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(x + 10, y + 12, 3, 0, Math.PI * 2);
          ctx.arc(x + 22, y + 20, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === TILE.GATE) {
          const gp = gateProgress;
          const gatePanelW = (TILE_SIZE - 8) / 2;
          const gateLeftX = x + 4 + (x + 1 - (x + 4)) * gp;
          const gateRightX = x + 4 + gatePanelW + (x + TILE_SIZE - gatePanelW - 1 - (x + 4 + gatePanelW)) * gp;

          if (gp > 0) {
            ctx.fillStyle = COLORS.path;
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }

          ctx.fillStyle = COLORS.gate;
          ctx.fillRect(gateLeftX, y + 4, gatePanelW, TILE_SIZE - 8);
          ctx.fillRect(gateRightX, y + 4, gatePanelW, TILE_SIZE - 8);

          ctx.globalAlpha = 1 - gp;
          ctx.strokeStyle = '#4e342e';
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const barX = x + 8 + i * 8;
            ctx.beginPath();
            ctx.moveTo(barX, y + 6);
            ctx.lineTo(barX, y + TILE_SIZE - 6);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (tile === TILE.KEY) {
          ctx.fillStyle = COLORS.key;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2 - 2, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x + TILE_SIZE / 2 + 4, y + TILE_SIZE / 2 - 2, 8, 3);
          ctx.fillRect(x + TILE_SIZE / 2 + 10, y + TILE_SIZE / 2 - 2, 3, 6);
        } else if (tile === TILE.EXIT) {
          const glow = 0.5 + Math.sin(time * 3) * 0.2;
          ctx.fillStyle = COLORS.exitGlow.replace('0.4', glow.toFixed(2));
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          const dp = doorProgress;
          const doorPanelW = (TILE_SIZE - 12) / 2;
          const doorLeftX = x + 6 + (x + 2 - (x + 6)) * dp;
          const doorRightX = x + 6 + doorPanelW + (x + TILE_SIZE - doorPanelW - 2 - (x + 6 + doorPanelW)) * dp;

          if (dp > 0) {
            ctx.fillStyle = '#0d2b12';
            ctx.fillRect(x + 6, y + 4, TILE_SIZE - 12, TILE_SIZE - 8);
          }

          ctx.fillStyle = COLORS.exit;
          ctx.fillRect(doorLeftX, y + 4, doorPanelW, TILE_SIZE - 8);
          ctx.fillRect(doorRightX, y + 4, doorPanelW, TILE_SIZE - 8);

          ctx.globalAlpha = 1 - dp;
          ctx.fillStyle = '#1b5e20';
          ctx.fillRect(x + TILE_SIZE / 2 - 3, y + TILE_SIZE / 2, 6, TILE_SIZE / 2 - 6);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  for (const rock of rocks) {
    const cx = rock.renderX ?? rock.col * TILE_SIZE + TILE_SIZE / 2;
    const cy = rock.renderY ?? rock.row * TILE_SIZE + TILE_SIZE / 2;
    const x = cx - TILE_SIZE / 2;
    const y = cy - TILE_SIZE / 2;
    ctx.fillStyle = COLORS.rock;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 6, TILE_SIZE - 8, TILE_SIZE - 10, 4);
    ctx.fill();
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
