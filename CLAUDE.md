# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

KnightGame: a dark-fantasy cinematic 2D platformer for the browser. It is hosted on GitHub Pages and embedded in a WordPress page via `<iframe>`. **`GAME_SPEC.md` (in Polish) is the authoritative spec.** It defines the characters, enemies, controls, levels, target file layout and the staged implementation plan. Read the relevant section before working on a feature.

## Running

There is no build step, no npm and no test suite. The game is plain ES modules loaded from `index.html` in the repo root. ES modules don't load over `file://`, so serve the repo root with any static server, for example:

```
npx --yes http-server -p 8000 -c-1
```

Then open http://localhost:8000. Python is not installed on this machine, but Node 18 and Chrome are. Press F3 in game to toggle the FPS/UPS/scene debug overlay.

Headless check: `chrome --headless=new --screenshot` works, but under `--virtual-time-budget` `requestAnimationFrame` barely advances. To see the game after a few seconds, load it from a wrapper page whose `load` event is delayed by a slow resource. With `--enable-logging=stderr --v=0`, console messages appear in stderr as `INFO:CONSOLE` lines. "Working" means the game runs with **no console errors**. Also check it inside a resized `<iframe>` and at phone widths.

## Hard constraints (from the spec)

- HTML5 Canvas plus vanilla JS ES modules. **Don't add external dependencies or build tooling without asking.**
- Internal resolution is 960×540, scaled to the window with the aspect ratio kept and crisp pixels.
- Fixed-timestep physics at 60 Hz with interpolated rendering. Gameplay logic runs in the fixed update, and rendering interpolates between states.
- All graphics are drawn procedurally on the canvas, and all sound is procedural Web Audio. Audio starts only after the first user interaction and has a mute toggle. Keep rendering (`Renderer`/`Sprite` layer) separate from entity logic so sprite sheets can replace the drawing code later.
- `localStorage` (progress, checkpoint, volume) goes through `src/core/Storage.js`. Wrap every access in try/catch. The game must work without storage.
- All gameplay constants (speeds, gravity, damage, timings) live in `src/config.js`. Don't hard-code them in entities.
- All content must be 100% original: no names, characters or art from existing games.
- In-game text is Polish. Code comments on key systems are Polish.

## Architecture (target layout, see the spec for the full tree)

- `src/main.js` handles boot, the game loop and canvas scaling. `src/core/Game.js` is the scene manager, and scenes (`src/scenes/`) own update and render for each screen.
- The player (`src/entities/Player.js`) is one state machine shared by both characters (`idle, run, jump, fall, ledgeGrab, climb, crouch, attack, special, hurt, dead`). Per-character stats and abilities live in `src/entities/characters/`. Enemies use their own simple state machines (`patrol, chase, attack, hurt, dead`).
- Levels (`src/world/levels/`) are pure data: a tile grid plus object lists (enemies, checkpoints, pickups, lights). `Level.js` loads them and handles tile collision.
- `src/world/Lighting.js` is central to gameplay, not just visuals. It draws a darkness overlay with light circles cut out, and **light weakens or repels enemies**. Enemy AI therefore needs to query the light sources.
- `src/core/Input.js` maps keyboard, gamepad and touch onto the same abstract actions (move, jump, attack, special, crouch, pause). Browser events are queued and committed in `input.beginStep()` at the start of each fixed step, so `wasPressed()` is true for exactly one physics step and quick taps are never lost. Read input only inside `update()`, never in `render()`.
- Scenes implement `enter(game)`, `exit()`, `update(dt)` and `render(ctx, alpha)`. `Game.setScene()` fades through black, and `pushOverlay()`/`popOverlay()` stack overlays such as pause. Only the top overlay updates, but every layer renders. For interpolation, keep the previous state (e.g. `prevT`) and lerp it with `alpha` in `render`.
- `src/core/util.js` provides `clamp`, `lerp`, the seeded `createRng` (procedural art should be deterministic) and `createCanvas` for offscreen pre-rendering of static layers.

## Workflow (from the spec)

- Implement **one stage at a time** (stages 1–8 in `GAME_SPEC.md`). After each stage: verify it runs error-free, update `README.md` (what works, controls), commit, then **stop and tell the user briefly what to test** before continuing.
- Commit messages use `feat: ...` / `fix: ...` / `refactor: ...`.
- Committing is fine, but **never `git push` without the user's approval.**
- If the spec is unclear, or you see a better approach, ask or propose it before making large changes.
