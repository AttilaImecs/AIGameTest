// Tiny procedural 8-bit music player. No audio files -- everything here is
// generated at runtime with the Web Audio API (square-wave oscillators),
// so there's nothing to download and nothing to license.

const NOTE_FREQS = {
  REST: 0,
  A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};

// Each track: a short looping melody, one per level. [note, beats] pairs.
const TRACKS = [
  { // 1. Garden Path -- cheerful and simple
    tempo: 150,
    notes: [
      ['C4', 1], ['E4', 1], ['G4', 1], ['C5', 1], ['G4', 1], ['E4', 1], ['C4', 2],
      ['D4', 1], ['F4', 1], ['A4', 1], ['D5', 1], ['A4', 1], ['F4', 1], ['D4', 2],
    ],
  },
  { // 2. Rainy Garden -- softer, minor-leaning
    tempo: 110,
    notes: [
      ['A3', 1], ['C4', 1], ['E4', 1], ['A4', 1], ['E4', 1], ['C4', 1], ['A3', 2],
      ['G4', 1], ['B3', 1], ['D4', 1], ['G4', 1], ['D4', 1], ['B3', 1], ['G4', 2],
    ],
  },
  { // 3. Locked Gate -- a little mysterious
    tempo: 120,
    notes: [
      ['E4', 1], ['REST', 0.5], ['G4', 0.5], ['E4', 1], ['REST', 0.5], ['C4', 0.5],
      ['D4', 1], ['REST', 0.5], ['F4', 0.5], ['D4', 1], ['REST', 1],
      ['E4', 1], ['G4', 1], ['B4', 1], ['C5', 2],
    ],
  },
  { // 4. Rocky Trail -- punchy and rhythmic
    tempo: 160,
    notes: [
      ['C4', 0.5], ['C4', 0.5], ['REST', 0.5], ['C4', 0.5], ['D4', 0.5], ['REST', 0.5],
      ['E4', 0.5], ['E4', 0.5], ['REST', 0.5], ['E4', 0.5], ['D4', 0.5], ['C4', 1],
      ['A3', 0.5], ['A3', 0.5], ['REST', 0.5], ['A3', 0.5], ['B3', 0.5], ['REST', 0.5],
      ['C4', 1],
    ],
  },
  { // 5. Final Gauntlet -- fast and intense
    tempo: 190,
    notes: [
      ['E4', 0.5], ['G4', 0.5], ['B4', 0.5], ['E5', 0.5], ['D5', 0.5], ['B4', 0.5], ['G4', 0.5], ['D4', 0.5],
      ['C4', 0.5], ['E4', 0.5], ['G4', 0.5], ['C5', 0.5], ['B4', 0.5], ['G4', 0.5], ['E4', 0.5], ['C4', 1],
    ],
  },
  { // 6. Daniel's Cats -- playful and bouncy
    tempo: 140,
    notes: [
      ['G4', 0.5], ['G4', 0.5], ['C5', 1], ['B4', 0.5], ['A4', 0.5], ['G4', 1],
      ['E4', 0.5], ['E4', 0.5], ['A4', 1], ['G4', 0.5], ['F4', 0.5], ['E4', 1],
      ['D4', 0.5], ['D4', 0.5], ['G4', 1], ['F4', 0.5], ['E4', 0.5], ['D4', 2],
    ],
  },
];

let audioCtx = null;
let currentTrackId = -1;
let currentTimeouts = [];
let currentGain = null;

function ensureContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playSequence(ctx, track, myId, gain) {
  if (myId !== currentTrackId) return;

  const beatSeconds = 60 / track.tempo;
  let cursor = 0;
  const timeouts = [];

  for (const [note, beats] of track.notes) {
    const dur = beats * beatSeconds;
    const freq = NOTE_FREQS[note];
    if (freq) {
      const delayMs = cursor * 1000;
      const t = setTimeout(() => {
        if (myId !== currentTrackId) return;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        const noteGain = ctx.createGain();
        const now = ctx.currentTime;
        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(dur * 0.85, 0.02));
        osc.connect(noteGain);
        noteGain.connect(gain);
        osc.start(now);
        osc.stop(now + dur);
      }, delayMs);
      timeouts.push(t);
    }
    cursor += dur;
  }

  const loopTimeout = setTimeout(() => playSequence(ctx, track, myId, gain), cursor * 1000);
  timeouts.push(loopTimeout);
  currentTimeouts = timeouts;
}

export function playLevelMusic(levelIndex) {
  const ctx = ensureContext();
  if (!ctx) return;
  const track = TRACKS[levelIndex % TRACKS.length];
  if (!track) return;

  stopMusic();
  currentTrackId += 1;
  const myId = currentTrackId;

  const gain = ctx.createGain();
  gain.gain.value = 0.07;
  gain.connect(ctx.destination);
  currentGain = gain;

  playSequence(ctx, track, myId, gain);
}

export function stopMusic() {
  currentTrackId += 1;
  for (const t of currentTimeouts) clearTimeout(t);
  currentTimeouts = [];
  if (currentGain) {
    try {
      currentGain.disconnect();
    } catch (e) {
      // already disconnected, nothing to do
    }
    currentGain = null;
  }
}
