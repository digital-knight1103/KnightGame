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
- [x] **Etap 3 – Dwie postacie**: ekran wyboru postaci (klawiatura, gamepad, dotyk), Rycerz Cieniołamacz (kombo mieczem z 3 ciosów, blok tarczą z wytrzymałością) i Łowczyni Świetlików (kusza z ładowanym, przebijającym bełtem, przewrót z nietykalnością, podwójny skok), manekiny treningowe, prosty HUD (serca, pasek umiejętności).
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

### Postacie

| | Rycerz Cieniołamacz | Łowczyni Świetlików |
|---|---|---|
| Zdrowie | 6 serc | 4 serca |
| Ruch | wolniejszy, niższy skok | szybka, wyższy skok + **podwójny skok** (z saltem) |
| Atak (J) | **kombo mieczem**: naciskaj J w rytm ciosów – 3. cios jest silniejszy i odrzuca | **kusza**: krótko = zwykły bełt; przytrzymaj (aż bełt rozbłyśnie) i puść = naładowany bełt, przebija do 4 celów |
| Umiejętność (K) | **blok tarczą** (trzymaj K): chroni z przodu, zużywa wytrzymałość (pasek w HUD) | **przewrót**: szybki zryw przy ziemi z chwilową nietykalnością; przerywa celowanie |

Ekran tytułowy → wybór postaci (← → i Enter/Spacja, albo dotknij panelu, a potem dotknij go ponownie) → poziom testowy. Esc na poziomie wraca do wyboru postaci (pełna pauza w Etapie 7). Obrażenia zadawane graczowi i przeciwnicy pojawią się w Etapie 4. Na razie ataki testuje się na manekinach.

### Poziom testowy (od lewej)

schodki 1–3 kafelki → przepaść (upadek = powrót na start) → stos platform przechodnich → ściana 4 kafelki (tylko chwytem krawędzi) → płaskowyż z niskim tunelem (tylko kucając) → wieża i wysoki skok w dół (ciężkie lądowanie) → ściana 5 kafelków → schodki do końca mapy. Przy starcie jest też nawis do sprawdzenia uderzenia głową w sufit. Manekiny stoją przy starcie, pod platformami i trzy w rzędzie za wieżą (do sprawdzenia przebijającego bełtu).
