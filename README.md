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
- [ ] Etap 2 – Ruch
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
| Podgląd FPS (debug) | F3 | – |

Na razie działa tylko ekran tytułowy: dowolny klawisz, przycisk gamepada, kliknięcie lub dotknięcie potwierdza wejście. Wybór postaci pojawi się w Etapie 3.
