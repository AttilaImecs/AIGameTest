---
name: snail-maze-dev
description: Use when adding features, entities, or level-editor capabilities to the Snail Maze game, or when testing/verifying changes to it in the Browser pane. Covers this codebase's file-by-file extension pattern and its browser-testing gotchas.
---

# Developing Snail Maze

Snail Maze (`AttilaImecs/AIGameTest`) is a static, no-build vanilla-JS ES-module
game (no bundler, no framework — `<script type="module" src="js/main.js">`).
All real work happens in the **main worktree** at `/Users/daetilus/Projects/snail-maze`,
branch **`claude-trial1`** — not whatever throwaway worktree the session was
launched in. `cd` there for every edit, test, and git operation. Only
commit/push when the user explicitly confirms it — ask "want me to commit and
push?" after finishing a feature, every time, even if they approved the last
one. One approval does not carry forward to the next feature.

## Adding a new obstacle/enemy/entity type

Follow this exact file-by-file recipe (proven for hazards, cats, zombies):

1. **`js/obstacles.js`** — add a class with `constructor(config)`,
   `update(dt, level, rocks, player)`, `draw(ctx, time)`, and (if hostile)
   `collidesWith(px, py, pr)`. Reuse the shared `computeDistanceField`/
   `stepToward` free functions for anything that should chase the player —
   don't duplicate BFS pathing. Export a `createXxx(configs)` factory:
   `(configs || []).map((c) => new Xxx(c))`.
2. **`js/maze.js`** `parseLevel()` — add a passthrough line:
   `xxx: (levelData.xxx || []).map((x) => ({ ...x })),`. Don't touch the
   built-in `LEVELS` array unless the user explicitly asks for the new
   entity to appear in a specific shipped level.
3. **`js/game.js`** — import the factory; add `this.xxx = []` next to
   `this.hazards`/`this.cats`; spawn it in `applyLevelData()`; add an
   update+collision loop in `update()` (hostile entities `return` right
   after `this.triggerFail(title, message)`, matching the hazard loop); add
   a draw loop in `render()` next to the hazard/cat draw loops.
4. **`js/editor.js`** — add an entry to `TOOL_HINTS`; add `this.xxx = []` in
   both `newGrid()` and `loadLevelIntoEditor()`; add a branch in
   `applyTool()` (click to place, click an existing one to remove — matches
   the `cat` case); include `xxx` in both `snapshotKey()` and
   `buildLevelData()` (skipping either means changes won't invalidate
   verification / won't get published); add a list block in
   `renderEntityLists()` (delete-button pattern matching cats/hazards); add
   a preview-marker loop in `render()` so it shows up on the editor canvas.
5. **`index.html`** — one `<button class="tool-btn" data-tool="xxx">` inside
   `#editor-tool-palette`, one `<div class="editor-list-block">` inside
   `.editor-lists`.
6. **`css/style.css`** — usually nothing to add; `.editor-lists` is
   `flex-direction: column` and `.editor-tool-palette` is an auto-growing
   grid, so new blocks/buttons just stack without new rules.

Extending the level-data shape itself (e.g. a new per-level setting like
`timeLimit`) follows the same shape: thread it through `parseLevel()`,
`Game.applyLevelData()`, and `Editor.buildLevelData()` /
`snapshotKey()` / `loadLevelIntoEditor()`, with a sensible fallback at every
consumption site (`Number.isFinite(x) && x > 0 ? x : DEFAULT`) so levels
saved/exported before the field existed keep working.

`js/customLevels.js`'s `isValidLevelShape()` should generally **not** be
tightened to require new optional fields — old exported text blobs won't
have them, and every consumer already falls back with `|| []` / a default,
so requiring the field would wrongly reject valid old backups on import.

## Verifying changes in the Browser pane

Two standing environment gotchas here — both silent (no error thrown, just
quietly wrong behavior) if forgotten:

- **The Browser pane tab can have `document.visibilityState === "hidden"`,
  which fully throttles/pauses `requestAnimationFrame`.** Real-time play
  (timers counting down, entities moving) looks completely frozen even
  though click/DOM handlers still work fine. Fix: temporarily add
  `window.__debug = { game, editor, ui };` right after `main.js` constructs
  them, then drive gameplay yourself via `javascript_tool` by calling
  `game.update(dt)` in a loop instead of waiting on real RAF timing. Also
  useful for driving a snail toward a target tile:
  ```js
  function stepToward(tc, tr, maxFrames) {
    for (let i = 0; i < maxFrames; i++) {
      const pc = Math.floor(game.player.x / 32), pr = Math.floor(game.player.y / 32);
      if (pc === tc && pr === tr) return true;
      const tx = tc * 32 + 16, ty = tr * 32 + 16;
      const dx = tx - game.player.x, dy = ty - game.player.y;
      input.up = input.down = input.left = input.right = false;
      if (Math.abs(dx) > 3) { input.left = dx < 0; input.right = dx > 0; }
      if (Math.abs(dy) > 3) { input.up = dy < 0; input.down = dy > 0; }
      game.update(1 / 60);
      if (game.status !== 'playing') return true;
    }
    return false;
  }
  ```
  **Always remove the `window.__debug` line before finishing** — grep the
  diff for it before reporting a feature done.
- **The game's own service worker (`sw.js`, cache-first) serves stale JS
  after every source edit.** Before re-testing anything, always run this in
  the tab, then a hard reload:
  ```js
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  const keys = await caches.keys();
  for (const k of keys) await caches.delete(k);
  ```

There's no committed dev-server config for this repo (`.claude/launch.json`
lives per-worktree and doesn't persist). Spin up a throwaway no-cache server
each session:
```python
import http.server, socketserver
PORT = 9020
class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    httpd.serve_forever()
```
Write it to `no_cache_server.py` in the main worktree, run it in the
background, open it with `preview_start({url: "http://localhost:9020"})`.
**Delete the script and kill the process when done** — it's scratch, not
part of the repo.

For headless assertions (chase-speed ratios, collision outcomes, publish
round-trips), call engine methods directly via `javascript_tool` rather than
simulating real input/pointer events — e.g.
`game.startCustomLevel(levelData, onExit)`, then drive frames with
`game.update(1/60)` in a loop. It's faster and more precise than pixel-
coordinate clicking, and works around the RAF-throttling issue for free.

To visually inspect a small entity sprite up close (screenshots of the
36x24px game canvas are too small to judge detail), draw it standalone at a
large scale on a temporary canvas appended to `document.body`, screenshot,
then remove the canvas:
```js
const { Xxx } = await import('/js/obstacles.js?t=' + Date.now());
const e = new Xxx({ col: 0, row: 0 }); e.x = 0; e.y = 0;
const c = document.createElement('canvas');
c.className = 'preview-scratch'; c.width = 200; c.height = 200;
c.style.cssText = 'position:fixed;top:400px;left:50px;z-index:9999';
document.body.appendChild(c);
const ctx = c.getContext('2d');
ctx.fillStyle = '#52b788'; ctx.fillRect(0, 0, 200, 200);
ctx.save(); ctx.translate(100, 110); ctx.scale(6, 6);
e.draw(ctx, 2.0);
ctx.restore();
```
The `?t=timestamp` on the dynamic import bypasses the module cache so edits
show up without a full page reload.

## Cleanup checklist (every session, before reporting done)

- [ ] `window.__debug` removed from `js/main.js`
- [ ] Test/scratch entries removed from `localStorage['snailMazeCustomLevels']`
- [ ] Any scratch preview `<canvas>` elements removed from the DOM
- [ ] Dev server process killed, `no_cache_server.py` deleted if you created it
- [ ] Browser tab closed (stops any audio/music that started during testing)
- [ ] Full regression: all 7 built-in levels still `game.loadLevel(i)` cleanly
      with the expected hazard/cat/zombie counts and no console errors
- [ ] Ask the user before committing/pushing — don't assume prior approval
      carries forward to a new feature
