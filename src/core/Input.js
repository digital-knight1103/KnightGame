import { INPUT, VIEW } from '../config.js';

// Mapowanie klawiszy na abstrakcyjne akcje. Używamy `event.code`, więc układ klawiatury nie ma znaczenia.
const KEY_BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  attack: ['KeyJ', 'KeyX'],
  special: ['KeyK', 'KeyC'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space', 'KeyJ', 'KeyX'],
  debug: ['F3'],
};

// Przyciski gamepada w standardowym układzie (A=0, B=1, X=2, Start=9, krzyżak 12–15).
const PAD_BUTTONS = {
  jump: [0],
  special: [1],
  attack: [2],
  pause: [9],
  confirm: [0, 9],
  up: [12],
  down: [13],
  left: [14],
  right: [15],
};

const ACTIONS = Object.keys(KEY_BINDINGS);

/**
 * System wejścia: klawiatura, gamepad i wskaźnik (mysz/dotyk).
 *
 * Zdarzenia przeglądarki przychodzą asynchronicznie, a logika gry działa w stałych krokach 60 Hz.
 * Dlatego naciśnięcia są zbierane w kolejce i „zatwierdzane” na początku kroku w `beginStep()`.
 * Dzięki temu krótkie stuknięcie (wciśnięcie i puszczenie między krokami) nigdy nie ginie,
 * a `wasPressed()` jest prawdziwe przez dokładnie jeden krok fizyki.
 */
export class Input {
  constructor(pointerTarget) {
    this.keysDown = new Set();
    this.keysPressedQueue = new Set();
    this.keysReleasedQueue = new Set();
    this.pointerQueued = null; // pozycja ostatniego kliknięcia/dotknięcia między krokami
    this.tap = null; // { x, y } w pikselach gry – kliknięcie w tym kroku

    this.down = {};
    this.pressed = {};
    this.released = {};
    this.anyPressedThisStep = false;

    this.padPrevActions = {};
    this.padPrevButtons = [];
    this.gamepadAvailable = typeof navigator.getGamepads === 'function';

    // Pierwsza interakcja użytkownika – potrzebna później do odblokowania Web Audio.
    this.hasInteracted = false;

    this.boundCodes = new Set(Object.values(KEY_BINDINGS).flat());
    for (const action of ACTIONS) {
      this.down[action] = false;
      this.pressed[action] = false;
      this.released[action] = false;
    }

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.releaseAllKeys());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAllKeys();
    });

    pointerTarget.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // W <iframe> klawiatura działa dopiero, gdy ramka ma fokus.
      pointerTarget.focus({ preventScroll: true });
      // Przeliczenie z pikseli ekranu na wewnętrzną rozdzielczość gry.
      const rect = pointerTarget.getBoundingClientRect();
      this.pointerQueued = {
        x: ((e.clientX - rect.left) / rect.width) * VIEW.width,
        y: ((e.clientY - rect.top) / rect.height) * VIEW.height,
      };
      this.hasInteracted = true;
    });
    pointerTarget.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyDown(e) {
    // Blokujemy przewijanie strony strzałkami/spacją (szczególnie ważne w <iframe>).
    if (this.boundCodes.has(e.code)) e.preventDefault();
    this.hasInteracted = true;
    if (e.repeat) return;
    this.keysDown.add(e.code);
    this.keysPressedQueue.add(e.code);
  }

  onKeyUp(e) {
    if (this.boundCodes.has(e.code)) e.preventDefault();
    if (this.keysDown.delete(e.code)) this.keysReleasedQueue.add(e.code);
  }

  releaseAllKeys() {
    for (const code of this.keysDown) this.keysReleasedQueue.add(code);
    this.keysDown.clear();
  }

  // Odczyt pierwszego podłączonego gamepada jako zestaw akcji.
  readGamepad() {
    const actions = {};
    let anyNewButton = false;
    if (!this.gamepadAvailable) return { actions, anyNewButton };

    let pad = null;
    try {
      for (const p of navigator.getGamepads()) {
        if (p && p.connected) {
          pad = p;
          break;
        }
      }
    } catch {
      // Np. zablokowane przez politykę uprawnień w <iframe>.
      this.gamepadAvailable = false;
    }
    if (!pad) {
      this.padPrevButtons = [];
      return { actions, anyNewButton };
    }

    const buttons = pad.buttons.map((b) => b.pressed);
    buttons.forEach((isDown, i) => {
      if (isDown && !this.padPrevButtons[i]) anyNewButton = true;
    });
    this.padPrevButtons = buttons;

    for (const [action, indices] of Object.entries(PAD_BUTTONS)) {
      actions[action] = indices.some((i) => buttons[i]);
    }

    const dz = INPUT.gamepadDeadzone;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (ax < -dz) actions.left = true;
    if (ax > dz) actions.right = true;
    if (ay < -dz) actions.up = true;
    if (ay > dz) actions.down = true;

    if (anyNewButton) this.hasInteracted = true;
    return { actions, anyNewButton };
  }

  // Wywoływane raz na początku każdego kroku fizyki.
  beginStep() {
    const pad = this.readGamepad();
    let anyKey = this.keysPressedQueue.size > 0;

    for (const action of ACTIONS) {
      const codes = KEY_BINDINGS[action];
      const keyDown = codes.some((c) => this.keysDown.has(c));
      const keyPressed = codes.some((c) => this.keysPressedQueue.has(c));
      const keyReleased = codes.some((c) => this.keysReleasedQueue.has(c));

      const padDown = !!pad.actions[action];
      const padWasDown = !!this.padPrevActions[action];

      this.down[action] = keyDown || padDown;
      this.pressed[action] = keyPressed || (padDown && !padWasDown);
      this.released[action] = (keyReleased && !keyDown) || (!padDown && padWasDown);
    }

    this.tap = this.pointerQueued;
    this.anyPressedThisStep = anyKey || pad.anyNewButton || !!this.tap;
    this.padPrevActions = pad.actions;
    this.keysPressedQueue.clear();
    this.keysReleasedQueue.clear();
    this.pointerQueued = null;
  }

  isDown(action) {
    return this.down[action];
  }

  wasPressed(action) {
    return this.pressed[action];
  }

  wasReleased(action) {
    return this.released[action];
  }

  // Dowolny klawisz, przycisk gamepada, kliknięcie lub dotknięcie w tym kroku.
  anyPressed() {
    return this.anyPressedThisStep;
  }
}
