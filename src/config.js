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

export const TILE_SIZE = 32;

// Ruch gracza (jednostki: piksele i sekundy). W Etapie 3 postacie nadpiszą część wartości.
export const PLAYER = {
  width: 20,
  height: 44,
  crouchHeight: 28,

  runSpeed: 215,
  crouchSpeed: 70,
  groundAccel: 1900, // rozpędzanie na ziemi
  groundDecel: 2300, // hamowanie po puszczeniu kierunku
  turnAccel: 3400, // zawracanie (przeciwny kierunek niż prędkość)
  airAccel: 1300,
  airDecel: 450,

  gravity: 2100,
  fallGravityMultiplier: 1.3, // cięższe opadanie niż wznoszenie
  apexGravityMultiplier: 0.55, // „zawieszenie” w szczycie skoku przy wciśniętym skoku
  apexThreshold: 70, // |vy| poniżej tego progu = szczyt skoku
  maxFallSpeed: 840,

  jumpHeight: 124, // ~3,9 kafelka: ściany 4+ wymagają chwytu krawędzi
  jumpCutMultiplier: 0.45, // puszczenie skoku przy wznoszeniu ucina prędkość
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  dropThroughTime: 0.22, // czas ignorowania platform przechodnich po zeskoku

  heavyLandingDistance: 200, // wysokość upadku, od której lądowanie unieruchamia
  heavyLandingTime: 0.3,

  ledgeHandOffset: 4, // jak nisko pod górną krawędzią hitboxa są dłonie przy chwycie
  ledgeReach: 8, // krawędź do tylu pikseli nad dłońmi też da się złapać (postać jest podciągana)
  ledgeClimbTime: 0.42,
  ledgeRegrabDelay: 0.3, // po puszczeniu krawędzi nie łapiemy jej od razu ponownie
};

export const CAMERA = {
  lookAhead: 80, // wyprzedzenie w kierunku patrzenia
  lookAheadSpeed: 2.5,
  followX: 7, // im większe, tym ciaśniej kamera trzyma się gracza
  followY: 5,
  anchorY: 0.62, // pozycja stóp gracza na ekranie (ułamek wysokości)
  upMargin: 150, // w powietrzu kamera rusza w górę dopiero po przekroczeniu tej odległości
};
