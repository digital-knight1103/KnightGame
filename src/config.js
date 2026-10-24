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

// Bazowy ruch gracza (jednostki: piksele i sekundy). Postacie nadpisują część wartości w CHARACTERS.
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
  airJumps: 0, // dodatkowe skoki w powietrzu
  airJumpHeight: 90,
  dropThroughTime: 0.22, // czas ignorowania platform przechodnich po zeskoku

  heavyLandingDistance: 200, // wysokość upadku, od której lądowanie unieruchamia
  heavyLandingTime: 0.3,

  ledgeHandOffset: 4, // jak nisko pod górną krawędzią hitboxa są dłonie przy chwycie
  ledgeReach: 12, // krawędź do tylu pikseli nad dłońmi też da się złapać (postać jest podciągana)
  ledgeClimbTime: 0.42,
  ledgeRegrabDelay: 0.3, // po puszczeniu krawędzi nie łapiemy jej od razu ponownie
};

// Grywalne postacie: zdrowie, nadpisania ruchu i parametry walki.
export const CHARACTERS = {
  knight: {
    maxHealth: 6,
    movement: {
      runSpeed: 190,
      groundAccel: 1600,
      groundDecel: 2100,
      jumpHeight: 114, // niższy skok – ciężka zbroja
    },
    // Kombo mieczem: kolejne ciosy łańcuchuje się naciśnięciem ataku w trakcie poprzedniego.
    combo: {
      swings: [
        { windup: 0.07, active: 0.09, recovery: 0.18, damage: 1, knockback: 90, lunge: 110, reach: 36, height: 34 },
        { windup: 0.06, active: 0.09, recovery: 0.18, damage: 1, knockback: 90, lunge: 110, reach: 36, height: 34 },
        { windup: 0.16, active: 0.11, recovery: 0.34, damage: 2, knockback: 340, lunge: 200, reach: 44, height: 40 },
      ],
      comboCooldown: 0.3, // przerwa po pełnym kombo
      cooldown: 0.08, // przerwa po urwanym kombo
    },
    // Blok tarczą: trzymany przycisk, zużywa wytrzymałość, która odnawia się po chwili.
    block: {
      damageReduction: 0.8, // ułamek obrażeń z przodu pochłaniany przez tarczę
      maxStamina: 1,
      drainPerSecond: 0.3,
      hitStaminaCost: 0.25,
      regenPerSecond: 0.45,
      regenDelay: 0.6,
      minStaminaToStart: 0.25, // po wyczerpaniu blok wraca dopiero od tego poziomu
      moveFactor: 0.3,
    },
  },

  huntress: {
    maxHealth: 4,
    movement: {
      runSpeed: 250,
      groundAccel: 2200,
      groundDecel: 2600,
      airAccel: 1500,
      jumpHeight: 138,
      airJumps: 1, // podwójny skok
      airJumpHeight: 96,
    },
    // Kusza: krótkie naciśnięcie = zwykły bełt, przytrzymanie = naładowany, przebijający.
    crossbow: {
      fullChargeTime: 0.6,
      reloadTime: 0.32,
      recoilTime: 0.12,
      aimMoveFactor: 0.5,
      bolt: { speed: 640, damage: 1, knockback: 60, range: 520, pierce: 0 },
      chargedBolt: { speed: 920, damage: 3, knockback: 160, range: 820, pierce: 3 },
    },
    // Przewrót: szybki zryw przy ziemi z nieśmiertelnością na początku.
    roll: {
      duration: 0.38,
      speed: 370,
      invulnerableTime: 0.3,
      cooldown: 0.55,
    },
  },
};

export const CAMERA = {
  lookAhead: 80, // wyprzedzenie w kierunku patrzenia
  lookAheadSpeed: 2.5,
  followX: 7, // im większe, tym ciaśniej kamera trzyma się gracza
  followY: 5,
  anchorY: 0.62, // pozycja stóp gracza na ekranie (ułamek wysokości)
  upMargin: 150, // w powietrzu kamera rusza w górę dopiero po przekroczeniu tej odległości
};
