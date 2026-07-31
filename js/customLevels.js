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
