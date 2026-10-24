import { LOOP, VIEW } from './config.js';
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { TitleScene } from './scenes/TitleScene.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Skalowanie: canvas ma zawsze 960×540 pikseli wewnętrznie, a CSS dopasowuje go do okna
// (lub ramki <iframe>) z zachowaniem proporcji 16:9. Pozostałe miejsce to czarne pasy.
// Ostre piksele przy powiększeniu zapewnia `image-rendering: pixelated` w style.css.
function resize() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

const input = new Input(canvas);
const game = new Game(input);
game.setScene(new TitleScene());

// Pętla gry ze stałym krokiem fizyki: czas rzeczywisty trafia do akumulatora, z którego
// „wypłacamy” kroki po 1/60 s. Resztę (alpha) wykorzystuje renderowanie do interpolacji
// między poprzednim a bieżącym stanem, więc ruch jest płynny przy dowolnym odświeżaniu ekranu.
let lastTime = performance.now();
let accumulator = 0;
let statFrames = 0;
let statSteps = 0;
let statTimer = 0;

function frame(now) {
  let frameTime = (now - lastTime) / 1000;
  lastTime = now;
  if (frameTime > LOOP.maxFrameTime) frameTime = LOOP.maxFrameTime;
  if (frameTime < 0) frameTime = 0;
  accumulator += frameTime;

  let steps = 0;
  while (accumulator >= LOOP.fixedDt && steps < LOOP.maxStepsPerFrame) {
    input.beginStep();
    game.update(LOOP.fixedDt);
    accumulator -= LOOP.fixedDt;
    steps++;
  }
  // Jeśli urządzenie nie nadąża, porzucamy zaległy czas zamiast go nadrabiać w nieskończoność.
  if (steps === LOOP.maxStepsPerFrame) accumulator %= LOOP.fixedDt;

  game.render(ctx, accumulator / LOOP.fixedDt);

  statFrames++;
  statSteps += steps;
  statTimer += frameTime;
  if (statTimer >= 1) {
    game.stats.fps = Math.round(statFrames / statTimer);
    game.stats.ups = Math.round(statSteps / statTimer);
    statFrames = 0;
    statSteps = 0;
    statTimer = 0;
  }

  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  // Po powrocie do karty nie chcemy jednej gigantycznej klatki.
  if (!document.hidden) lastTime = performance.now();
});

requestAnimationFrame(frame);
