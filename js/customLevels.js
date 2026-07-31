// Persistence for player-published levels. There's no backend for this game
// (static files only), so "publishing" a level means saving it in this
// browser's localStorage and merging it into the level list at runtime.

import { LEVELS } from './maze.js';

const STORAGE_KEY = 'snailMazeCustomLevels';

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeRaw(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    // Storage full or unavailable -- nothing more we can do client-side.
  }
}

export function loadCustomLevels() {
  return readRaw();
}

// position is 1-based, matching how levels are displayed ("Level N").
export function saveCustomLevel(level, position) {
  const entries = readRaw();
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  entries.push({ id, level, position });
  writeRaw(entries);
  return id;
}

export function deleteCustomLevel(id) {
  const entries = readRaw().filter((e) => e.id !== id);
  writeRaw(entries);
}

const EXPORT_TYPE = 'snail-maze-levels';
const EXPORT_VERSION = 1;

// Produces a copy-pasteable text blob of every published level (drops the
// internal storage id -- import always mints a fresh one, same as a normal
// publish). This is the only way levels move between browsers/devices,
// since there's no server to sync them through.
export function exportCustomLevels() {
  const entries = readRaw();
  const payload = {
    type: EXPORT_TYPE,
    version: EXPORT_VERSION,
    levels: entries.map((e) => ({ level: e.level, position: e.position })),
  };
  return JSON.stringify(payload, null, 2);
}

function isValidLevelShape(level) {
  return (
    level &&
    typeof level.name === 'string' &&
    Array.isArray(level.grid) &&
    level.grid.every((row) => typeof row === 'string') &&
    Array.isArray(level.hazards) &&
    Array.isArray(level.cats)
  );
}

// Parses a blob produced by exportCustomLevels and appends every valid
// entry as a freshly-published level (existing levels are untouched, never
// overwritten). Returns a summary rather than throwing, so the editor can
// show a clear status message either way.
export function importCustomLevels(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "That doesn't look like valid level data (couldn't parse it)." };
  }

  if (!parsed || parsed.type !== EXPORT_TYPE || !Array.isArray(parsed.levels)) {
    return { ok: false, error: "That doesn't look like a snail-maze level export." };
  }

  let imported = 0;
  let skipped = 0;
  for (const entry of parsed.levels) {
    const level = entry && entry.level;
    const position = Number.isFinite(entry?.position) ? entry.position : 999;
    if (!isValidLevelShape(level)) {
      skipped++;
      continue;
    }
    saveCustomLevel(level, position);
    imported++;
  }

  return { ok: true, imported, skipped };
}

// Merges built-in LEVELS with published custom levels, ordered by each
// custom level's requested position (existing levels shift down). This is
// the single list every screen in the game should read from.
export function getCombinedLevels() {
  const custom = readRaw();
  const combined = LEVELS.map((level) => ({ level, id: null, builtIn: true }));

  const sortedCustom = [...custom].sort((a, b) => a.position - b.position);
  for (const entry of sortedCustom) {
    const insertAt = Math.max(0, Math.min(combined.length, entry.position - 1));
    combined.splice(insertAt, 0, { level: entry.level, id: entry.id, builtIn: false });
  }

  return combined;
}
