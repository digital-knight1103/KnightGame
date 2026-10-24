# KnightGame

Kinowa platformówka 2D w klimacie dark fantasy, działająca w przeglądarce (HTML5 Canvas + czysty JavaScript, bez frameworków i bez budowania). Pełna specyfikacja: [`GAME_SPEC.md`](GAME_SPEC.md).

## Uruchamianie lokalnie

Gra używa modułów ES, więc nie zadziała po otwarciu `index.html` bezpośrednio z dysku (`file://`). Uruchom dowolny serwer statyczny w katalogu repozytorium, np.:

```
npx --yes http-server -p 8000 -c-1
# albo, jeśli masz Pythona:
python -m http.server 8000
```

i otwórz http://localhost:8000.

Na GitHub Pages wystarczy wrzucić pliki – wszystkie ścieżki są względne.

## Stan prac

- [x] **Etap 1 – Fundament**: pętla gry ze stałym krokiem 60 Hz i interpolacją, skalowanie canvasu 960×540 do okna/`<iframe>`, obsługa klawiatury i gamepada, menedżer scen z płynnymi przejściami, animowany ekran tytułowy.
- [x] **Etap 2 – Ruch**: poziom testowy z kafelków (zapisany jako dane), kolizje, platformy przechodnie, kamera z wyprzedzeniem, pełny ruch gracza: bezwładność, coyote time, bufor skoku, zmienna wysokość skoku, chwytanie krawędzi i podciąganie, kucanie, ciężkie lądowanie, proceduralne animacje.
- [ ] Etap 3 – Dwie postacie
- [ ] Etap 4 – Potwory i walka
- [ ] Etap 5 – Klimat
- [ ] Etap 6 – Zawartość
- [ ] Etap 7 – Boss i ekrany końcowe
- [ ] Etap 8 – Mobile i szlif

## Sterowanie

| Akcja | Klawiatura | Gamepad |
|---|---|---|
| Ruch | ← → / A D | lewa gałka / krzyżak |
| Skok | Spacja / W / ↑ | A |
| Atak | J / X | X |
| Umiejętność | K / C | B |
| Kucanie | ↓ / S | dół |
| Pauza | Esc / P | Start |
| Zeskok z platformy | ↓ + Spacja | dół + A |
| Podgląd debug (FPS, hitbox, stan) | F3 | – |

**Krawędzie:** skacząc w stronę ściany, trzymaj kierunek do niej – postać złapie krawędź. Skok lub ↑ = podciągnięcie, ↓ albo kierunek od ściany = puszczenie.

Z ekranu tytułowego dowolny klawisz (lub kliknięcie / dotknięcie) przenosi na poziom testowy. Esc na poziomie tymczasowo wraca do menu (pełna pauza w Etapie 7). Wybór postaci pojawi się w Etapie 3.

### Poziom testowy (od lewej)

schodki 1–3 kafelki → przepaść (upadek = powrót na start) → stos platform przechodnich → ściana 4 kafelki (tylko chwytem krawędzi) → płaskowyż z niskim tunelem (tylko kucając) → wieża i wysoki skok w dół (ciężkie lądowanie) → ściana 5 kafelków → schodki do końca mapy. Przy starcie jest też nawis do sprawdzenia uderzenia głową w sufit.
