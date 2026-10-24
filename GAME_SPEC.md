# KnightGame – specyfikacja gry dla Claude Code

## Rola i cel

Jesteś doświadczonym programistą gier 2D w JavaScript. Twoim zadaniem jest stworzenie **kinowej platformówki 2D** (cinematic platformer) w mrocznym klimacie dark fantasy: płynne, „ciężkie” animacje postaci, przechodzenie między ekranami/lokacjami, atmosfera ciemności, światła i cieni, walka z potworami z cienia.

Gra ma działać w przeglądarce, być hostowana na **GitHub Pages** i osadzana na stronie WordPress przez `<iframe>`.

**Wszystkie postacie, potwory, nazwy, grafiki i dźwięki muszą być w 100% oryginalne.** Nie używaj postaci, nazw, logo ani grafik z istniejących gier.

---

## Wymagania techniczne

- **HTML5 Canvas + czysty JavaScript (ES Modules)**, bez frameworków i bez narzędzi budujących (bez npm build). Projekt ma działać po wrzuceniu plików na GitHub Pages.
- Plik startowy: `index.html` w katalogu głównym repozytorium.
- **Wewnętrzna rozdzielczość 960×540** (16:9), skalowana do rozmiaru okna z zachowaniem proporcji i ostrych pikseli (`imageSmoothingEnabled = false` tam, gdzie to ma sens). Gra musi poprawnie działać w `<iframe>` o dowolnym rozmiarze i na telefonie.
- **Pętla gry ze stałym krokiem fizyki** (fixed timestep 60 Hz) i interpolowanym renderowaniem.
- **Grafika generowana kodem** (rysowanie na canvasie: kształty, gradienty, sylwetki, cząsteczki). Bez zewnętrznych plików graficznych na tym etapie. Architektura ma jednak pozwalać na późniejszą podmianę na sprite sheety (warstwa `Renderer`/`Sprite` oddzielona od logiki).
- **Dźwięk generowany przez Web Audio API** (proceduralne efekty: kroki, skok, cios, trafienie, śmierć potwora, ambient). Przycisk wyciszenia; dźwięk startuje dopiero po pierwszej interakcji użytkownika.
- **Zapis postępu w `localStorage`** (odblokowane poziomy, ostatni checkpoint, ustawienia głośności). Każdy odczyt i zapis w `try/catch`, gra musi działać także bez dostępu do pamięci.
- Brak błędów w konsoli. Kod czytelny, z komentarzami po polsku przy kluczowych systemach.

---

## Struktura projektu

```
/
├── index.html
├── style.css
├── README.md
└── src/
    ├── main.js              # start gry, pętla, skalowanie canvasu
    ├── core/
    │   ├── Game.js          # menedżer scen i stanu gry
    │   ├── Input.js         # klawiatura, gamepad, sterowanie dotykowe
    │   ├── Camera.js
    │   ├── Audio.js         # Web Audio, proceduralne efekty
    │   └── Storage.js       # bezpieczny localStorage
    ├── scenes/
    │   ├── TitleScene.js
    │   ├── CharacterSelectScene.js
    │   ├── LevelScene.js
    │   ├── PauseOverlay.js
    │   ├── GameOverScene.js
    │   └── VictoryScene.js
    ├── entities/
    │   ├── Player.js        # wspólna logika gracza (maszyna stanów)
    │   ├── characters/      # definicje dwóch grywalnych postaci
    │   ├── enemies/         # potwory
    │   ├── Projectile.js
    │   └── Pickup.js
    ├── world/
    │   ├── Level.js         # ładowanie poziomu, kafelki, kolizje
    │   ├── levels/          # dane poziomów (tablice / obiekty JS)
    │   ├── Lighting.js      # warstwa ciemności i źródła światła
    │   └── Parallax.js
    ├── fx/
    │   └── Particles.js
    └── ui/
        ├── HUD.js
        └── TouchControls.js
```

---

## Grywalne postacie (wybór na ekranie wyboru postaci)

Obie postacie dzielą wspólny system ruchu, ale różnią się statystykami i stylem walki.

### 1. Rycerz Cieniołamacz (walka wręcz)
- Zdrowie: 6 serc, prędkość: średnia, skok: niższy.
- Atak: **kombo mieczem z 3 ciosów** (trzeci cios silniejszy, odrzuca wroga).
- Umiejętność specjalna: **blok tarczą** (redukuje obrażenia z przodu, krótka wytrzymałość odnawiająca się w czasie).
- Wygląd: ciężka zbroja, płaszcz, miecz z delikatnie świecącym ostrzem (świeci w ciemności, jest źródłem światła).

### 2. Łowczyni Świetlików (walka dystansowa)
- Zdrowie: 4 serca, prędkość: wysoka, skok: wyższy + **podwójny skok**.
- Atak: **kusza z bełtami świetlnymi**; przytrzymanie przycisku ładuje mocniejszy, przebijający strzał.
- Umiejętność specjalna: **unik / przewrót** z krótką nieśmiertelnością (i-frames).
- Wygląd: lekki kaptur, latarnia przy pasie dająca krąg światła.

Każda postać ma inną paletę kolorów i własną sylwetkę rozpoznawalną nawet w ciemności.

---

## Sterowanie i ruch (feel jest najważniejszy)

| Akcja | Klawiatura | Gamepad | Dotyk |
|---|---|---|---|
| Ruch | ← → / A D | lewa gałka / krzyżak | wirtualny joystick |
| Skok | Spacja / W / ↑ | A | przycisk |
| Atak | J / X | X | przycisk |
| Umiejętność | K / C | B | przycisk |
| Kucanie | ↓ / S | dół | joystick w dół |
| Pauza | Esc / P | Start | ikona pauzy |

Wymagania co do ruchu:
- Przyspieszanie i hamowanie (nie natychmiastowa prędkość), wyraźna bezwładność.
- **Coyote time** (~100 ms) i **jump buffering** (~120 ms).
- Zmienna wysokość skoku (krótkie naciśnięcie = niski skok).
- **Chwytanie się krawędzi** i podciąganie (charakterystyczne dla kinowych platformówek).
- Kucanie, lądowanie z krótką animacją po wysokim upadku.
- Gracz jako **maszyna stanów**: `idle, run, jump, fall, ledgeGrab, climb, crouch, attack, special, hurt, dead`.
- Animacje proceduralne: oddychanie w spoczynku, kołysanie przy biegu, rozciąganie/ściskanie przy skoku i lądowaniu, smuga przy ataku.

---

## Potwory (oryginalne istoty z cienia)

1. **Pełzacz** – nisko przy ziemi, patroluje platformę, przyspiesza, gdy zobaczy gracza. 1 trafienie z kombo zabija.
2. **Skrzydlak** – latający, krąży, co jakiś czas nurkuje w stronę gracza po łuku.
3. **Strzelec Mroku** – stoi w miejscu, wystrzeliwuje wolne pociski cienia; ucieka przed światłem.
4. **Kolos** – duży, powolny, ma telegrafowany atak (wyraźne przygotowanie przed ciosem), wymaga kilku trafień.
5. **Boss: Władca Głębi** – na końcu ostatniego poziomu, **3 fazy** z różnymi wzorcami ataków, pasek zdrowia na górze ekranu.

Wymagania AI:
- Każdy przeciwnik ma prostą maszynę stanów (`patrol, chase, attack, hurt, dead`).
- **Światło osłabia potwory**: przebywanie w kręgu światła gracza spowalnia je lub sprawia, że się cofają. To główna mechanika klimatu gry.
- Trafienie: błysk na biało, odrzut, krótki **hit-stop** (zamrożenie klatki ~50 ms) i lekki **screen shake**.
- Śmierć potwora: rozpad na cząsteczki dymu.

---

## Świat i poziomy

- Minimum **3 poziomy** + arena bossa, każdy zbudowany z kilku połączonych **ekranów/pomieszczeń** (płynne przejście kamery lub krótkie przejście ekranu).
- Tematy: 1) Martwy las, 2) Ruiny zamku, 3) Jaskinie pod zamkiem, 4) Sala Władcy Głębi.
- Poziomy zapisane jako **dane** (siatka kafelków + lista obiektów: przeciwnicy, checkpointy, znajdźki, źródła światła), żeby łatwo było dodawać nowe.
- **Checkpointy** (świecące kapliczki), po śmierci powrót do ostatniego checkpointu.
- Znajdźki: serce (leczenie), odłamek światła (punkty / licznik w HUD).
- Elementy otoczenia: przepaści, kolce, ruchome platformy, platformy zapadające się.

### Oprawa wizualna
- **Warstwa ciemności** nakładana na scenę, z wycinanymi kręgami światła (gracz, pochodnie, kapliczki, pociski świetlne), z miękkim gradientem na krawędziach.
- **Paralaksa** w 3-4 warstwach tła.
- Mgła, latające drobinki, migotanie pochodni.
- Spójna, ciemna paleta z ciepłymi akcentami światła.

---

## Ekrany i interfejs

- **Ekran tytułowy**: nazwa gry, animowane tło, „Naciśnij dowolny klawisz”.
- **Wybór postaci**: dwie postacie obok siebie z animacją idle, krótki opis i paski statystyk (zdrowie, szybkość, zasięg).
- **HUD**: serca, pasek umiejętności, licznik odłamków światła, przycisk wyciszenia.
- **Pauza**: wznów, restart od checkpointu, głośność, wyjście do menu.
- **Game Over** i **ekran zwycięstwa** z podsumowaniem (czas, odłamki, pokonani wrogowie).
- Wszystkie teksty w grze po polsku.

---

## Plan realizacji (pracuj etapami)

Realizuj **jeden etap naraz**. Po każdym etapie:
1. upewnij się, że gra uruchamia się bez błędów,
2. zaktualizuj `README.md` (co działa, sterowanie),
3. zrób **commit** z opisem w formacie: `feat: krótki opis` / `fix: ...` / `refactor: ...`,
4. **zatrzymaj się i napisz mi krótko, co przetestować**, zanim przejdziesz dalej.

- **Etap 1 – Fundament**: struktura plików, pętla gry, skalowanie canvasu, Input, menedżer scen, ekran tytułowy.
- **Etap 2 – Ruch**: testowy poziom z kafelków, kolizje, kamera, pełny ruch gracza (skok, coyote time, krawędzie, kucanie).
- **Etap 3 – Dwie postacie**: ekran wyboru, różne statystyki, ataki i umiejętności specjalne.
- **Etap 4 – Potwory i walka**: Pełzacz i Skrzydlak, obrażenia, hit-stop, screen shake, cząsteczki, HUD.
- **Etap 5 – Klimat**: system światła i ciemności, paralaksa, mgła, dźwięki Web Audio.
- **Etap 6 – Zawartość**: pozostali przeciwnicy, 3 poziomy, checkpointy, znajdźki, przeszkody, zapis postępu.
- **Etap 7 – Boss i ekrany końcowe**: Władca Głębi (3 fazy), pauza, Game Over, zwycięstwo.
- **Etap 8 – Mobile i szlif**: sterowanie dotykowe, gamepad, balans trudności, optymalizacja (stałe 60 FPS), test w `<iframe>`.

---

## Zasady jakości

- Nie wprowadzaj zależności zewnętrznych bez pytania.
- Nie wysyłaj (`git push`) bez mojej zgody, same commity są OK.
- Jeśli coś w specyfikacji jest niejasne albo widzisz lepsze rozwiązanie, zapytaj lub zaproponuj, zanim zaczniesz duże zmiany.
- Stałe gameplayowe (prędkości, grawitacja, obrażenia, czasy) trzymaj w jednym pliku konfiguracyjnym `src/config.js`, żeby łatwo było balansować grę.
