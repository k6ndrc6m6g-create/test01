# Geografie-Lern-Apps

Zwei Web-Apps (PWA) für das iPhone, die sich wie normale Apps auf den Home-Bildschirm legen lassen und danach auch offline funktionieren:

| App | Adresse | Farbschema |
|---|---|---|
| **Die Staaten der USA** | `https://<benutzername>.github.io/<repository>/` | Petrol auf warmem Off-White |
| **Die Länder Europas** | `https://<benutzername>.github.io/<repository>/europa/` | dezentes Blau |
| **München** | `https://<benutzername>.github.io/<repository>/muenchen/` | dunkles Grün |

## München

Die 25 Stadtbezirke mit amtlichen Grenzen (die 108 Stadtbezirksteile sind als feine Linien eingezeichnet – sie haben offiziell nur Nummern, keine Namen), bekannte Stadtteile und Viertel sowie das S- und U-Bahn-Netz.

| Bereich | Modi |
|---|---|
| **Stadtbezirke** | Auswahl, Eingabe, Auf der Karte finden, Gegen die Uhr |
| **Stadtteile & Viertel** | Haidhausen, Werksviertel, Borstei … – in welchem Stadtbezirk liegt es? (rund 145 Einträge) |
| **S- und U-Bahn** | Haltestelle → Stadtbezirk (Auswahl oder auf der Karte), Endhaltestellen einer Linie, Endhaltestelle → Linie |
| **Experte** | Welche Linien halten an dieser Haltestelle? (Mehrfachauswahl) |
| **Erkunden** | Karte mit Netz – Bezirk oder Haltestelle antippen |

Linien: U1–U8, S1–S8 und S20. Die Zuordnung der Haltestellen zu den Bezirken wird aus den MVV-Koordinaten und den amtlichen Bezirksgrenzen berechnet. Die Endhaltestellen sind redaktionell festgelegt (Normalbetrieb, jeweils die äußeren Enden), weil der Fahrplan auch Baustellen- und Verstärkerfahrten enthält.


## Die Länder Europas

47 Länder (EU, Westbalkan, Skandinavien, Kleinstaaten, Ukraine, Belarus, Moldau, Russland und Türkei), deutsche Namen.
Alle Spielmodi der USA-App gibt es auch hier (Auswahl, Eingabe, Karte finden, Hauptstädte, Gegen die Uhr, Erkunden). Dazu kommen:

| Modus | Aufgabe |
|---|---|
| **Flagge erkennen** | Eine Flagge wird gezeigt – das Land aus vier Möglichkeiten wählen. Als falsche Antworten kommen bevorzugt ähnlich aussehende Flaggen (z. B. Rumänien/Moldau, Slowakei/Slowenien). |
| **Flagge benennen** | Eine Flagge wird gezeigt – den Ländernamen eintippen. |

Weitere Details:

- **Eingabe:** Umlaute dürfen fehlen („Osterreich“, „Oesterreich“). Gängige Alternativen werden akzeptiert („Holland“, „Weißrussland“, „Großbritannien“).
- **Kleinstaaten** wie Vatikanstadt, Monaco oder San Marino werden herangezoomt und mit einem Ring markiert.
- **Lernstand:** Ländernamen, Flaggen und Hauptstädte werden getrennt erfasst.

## Die Staaten der USA

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

Hinweis: Nach Änderungen an den App-Dateien im jeweiligen `sw.js` die `VERSION` erhöhen, damit installierte Apps die neue Fassung laden.

## Entwicklung

Alle Apps sind reines HTML/CSS/JavaScript ohne Build-Schritt. Die USA-App liegt in `app/`, die Europa-App in `app/europa/`, die München-App in `app/muenchen/` – jeweils mit eigenen, unabhängigen Dateien.

```bash
npm install          # nur für Kartengenerator und Tests nötig
npm start            # lokaler Server auf http://localhost:8080
npm test             # Logik-Tests (Antwortprüfung, Fragenauswahl, Kartendaten)
npm run build:map    # app/js/data/map.js neu aus us-atlas erzeugen
npm run build:europe # Europa-Karte aus world-atlas erzeugen und Flaggen kopieren
npm run build:muenchen # München-Daten aus Geoportal, MVV-Fahrplan und Wikipedia erzeugen
npm run build:icons  # App-Icons beider Apps neu erzeugen (Python + Pillow)
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
  europa/            Europa-App (gleicher Aufbau, zusätzlich flags/ mit den Länderflaggen)
  muenchen/          München-App (gleicher Aufbau; Daten in js/data/ aus tools/build-muenchen.py)
tools/               Generatoren für Karten, Flaggen und Icons
tests/               Node-Tests
```

Kartendaten: [us-atlas](https://github.com/topojson/us-atlas) (U.S. Census Bureau, gemeinfrei) und
[world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, gemeinfrei).
Flaggen: [flag-icons](https://github.com/lipis/flag-icons) (MIT-Lizenz, siehe `app/europa/flags/LICENSE`).
München: Stadtbezirke und Stadtbezirksteile © Landeshauptstadt München, Geoportal ([Datenlizenz Deutschland – Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0));
S- und U-Bahn © Münchner Verkehrs- und Tarifverbund, Sollfahrplan Gesamtnetz (CC BY 4.0);
Stadtteile und Viertel: Wikipedia, „Stadtteile, Quartiere und Siedlungen in München“ (CC BY-SA 4.0).
