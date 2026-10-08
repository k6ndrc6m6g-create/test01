# Die Staaten der USA

Eine Web-App (PWA) für das iPhone, mit der man die 50 US-Bundesstaaten spielerisch lernt.
Sie lässt sich wie eine normale App auf den Home-Bildschirm legen und funktioniert danach auch offline.

## Spielmodi

| Modus | Aufgabe |
|---|---|
| **Stufe 1 · Auswahl** | Ein Staat ist auf der Karte markiert – den richtigen Namen aus vier Möglichkeiten wählen. |
| **Stufe 2 · Eingabe** | Ein Staat ist markiert – den Namen eintippen. Groß-/Kleinschreibung ist egal, kleine Tippfehler und gängige deutsche Namen (z. B. „Kalifornien“, „Nord-Dakota“) werden akzeptiert. |
| **Auf der Karte finden** | Der Name ist vorgegeben – den Staat auf der Karte antippen (mit zwei Fingern zoomen). |
| **Hauptstädte** | Zum markierten Staat die Hauptstadt wählen. |
| **Gegen die Uhr** | So viele Staaten wie möglich in 60 Sekunden. |
| **Karte erkunden** | Staat antippen und Hauptstadt sowie Nachbarstaaten sehen. |

Weitere Details:

- **Rundenlänge** 10, 25 oder alle 50 Fragen.
- **Lernlogik:** Staaten, die oft falsch beantwortet wurden, kommen häufiger dran. Am Rundenende lassen sich die Fehler gezielt wiederholen.
- **Antwortauswahl:** Die falschen Antwortmöglichkeiten sind bevorzugt Nachbarstaaten.
- **Kleine Staaten** (Rhode Island, Delaware, …) werden automatisch herangezoomt und zusätzlich mit einem Ring markiert.
- **Lernstand:** Eine Karte zeigt farbig, welche Staaten sicher sitzen. Alles wird nur lokal auf dem Gerät gespeichert.
- **Darstellung:** heller und dunkler Modus folgen der Systemeinstellung. Die Haptik lässt sich abschalten.

## Auf dem iPhone installieren

1. App veröffentlichen (siehe unten) und die Adresse in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Die App startet nun im Vollbild und läuft auch ohne Internet.

## Veröffentlichen mit GitHub Pages

Der Workflow `.github/workflows/pages.yml` veröffentlicht den Ordner `app/` bei jedem Push auf `main`.
Einmalig nötig: im Repository unter **Settings → Pages → Build and deployment → Source** den Eintrag **„GitHub Actions“** wählen.
Die Adresse lautet dann `https://<benutzername>.github.io/<repository>/`.

Hinweis: Nach Änderungen an den App-Dateien in `app/sw.js` die `VERSION` erhöhen, damit installierte Apps die neue Fassung laden.

## Entwicklung

Die App ist reines HTML/CSS/JavaScript ohne Build-Schritt.

```bash
npm install          # nur für Kartengenerator und Tests nötig
npm start            # lokaler Server auf http://localhost:8080
npm test             # Logik-Tests (Antwortprüfung, Fragenauswahl, Kartendaten)
npm run build:map    # app/js/data/map.js neu aus us-atlas erzeugen
npm run build:icons  # App-Icons neu erzeugen (Python + Pillow)
```

Aufbau:

```
app/
  index.html, manifest.webmanifest, sw.js
  css/styles.css
  js/app.js          Bildschirme und Spielablauf
  js/map.js          SVG-Karte, Zoom, Gesten
  js/answer.js       Prüfung der Texteingabe (tolerant)
  js/questions.js    gewichtete Fragenauswahl, Antwortmöglichkeiten
  js/storage.js      Lernstand & Einstellungen (localStorage)
  js/haptics.js      haptisches Feedback
  js/data/           Staaten-Stammdaten und erzeugte Kartengeometrie
tools/               Generatoren für Karte und Icons
tests/               Node-Tests
```

Kartendaten: [us-atlas](https://github.com/topojson/us-atlas) (U.S. Census Bureau, gemeinfrei).
