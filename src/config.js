// Wszystkie stałe gry w jednym miejscu – tutaj balansujemy rozgrywkę.

export const GAME_TITLE = 'KnightGame';

// Wewnętrzna rozdzielczość (16:9); canvas jest skalowany do okna z zachowaniem proporcji.
export const VIEW = {
  width: 960,
  height: 540,
};

// Pętla gry: stały krok fizyki 60 Hz + interpolowane renderowanie.
export const LOOP = {
  fixedDt: 1 / 60,
  maxFrameTime: 0.25, // s – dłuższa klatka (np. po powrocie do karty) jest przycinana
  maxStepsPerFrame: 8, // ochrona przed „spiralą śmierci” na wolnych urządzeniach
};

export const INPUT = {
  gamepadDeadzone: 0.35,
};

export const SCENES = {
  fadeTime: 0.45, // s – czas wygaszania/rozjaśniania przy zmianie sceny
};
