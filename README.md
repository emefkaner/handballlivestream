# Handball-Kalender zum Abonnieren

Erzeugt eine iCal-Datei mit

- allen **Heimspielen der TSB Hunters** (TSB Heilbronn-Horkheim, 3. Liga Süd) und
- **allen Spielen der Sport-Union Neckarsulm** (Damen, 1. Bundesliga und DHB-Pokal, Heim und auswärts).

Ein GitHub-Actions-Lauf baut die Datei zweimal täglich neu und legt sie auf
GitHub Pages ab. Kalender-Apps holen sich Änderungen dort von allein — kein
Server, keine laufenden Kosten.

## Woher die Daten kommen

| Mannschaft | Quelle | Wie |
|---|---|---|
| TSB Hunters | `webapi.tsb-horkheim-hunters.de` | dieselbe Schnittstelle, aus der sich auch die Kalenderseite des Vereins bedient. Der nötige Lese-Schlüssel steht im ausgelieferten JavaScript der Seite und wird bei **jedem Lauf frisch von dort geholt** — er liegt bewusst nicht im Repo. |
| SU Neckarsulm | `hbf-cms.deinsportplatz.de/data/leagues/league_<Saison>.json` | die statischen Spielplandateien hinter `alsco-hbf.de` (früher `hbf-info.de`). |

Beide Dateien nennen jedes Spiel in UTC; der Kalender übernimmt das
unverändert, damit Sommer- und Winterzeit von selbst stimmen.

Die Saison sucht sich der Bau **selbst**: Jede HBF-Spielplandatei führt unter
`seasons` auch alle übrigen Saisons auf. Gesucht wird die laufende (ab Juli
zählt das neue Saisonjahr). Findet er sie nicht, nimmt er die hinterlegte
Saison und schreibt eine Warnung ins Protokoll.

## Was im Termin steht

- **Titel**: `TSB Hunters – HSG Albstadt (3. Liga Süd)`. Ist das Spiel vorbei,
  steht das Ergebnis dahinter; ist es abgesagt, beginnt der Titel mit `ABGESAGT:`.
- **Dauer**: zwei Stunden ab Anpfiff. Die Quellen nennen kein Spielende;
  2 × 30 Minuten plus Pause und Ein-/Auslauf sind die ehrliche Schätzung
  (`SPIELDAUER_MINUTEN` in `src/ics.mjs`).
- **Ort**: nur, wenn die Quelle einen nennt — bei den Hunters die Stauwehrhalle,
  bei Neckarsulm liefern die Daten keine Halle.

## Selbst bauen

```bash
npm run build     # schreibt site/
npm test          # prüft die Bausteine und die erzeugte Datei
```

Der Bau bricht ab, ohne etwas zu schreiben, wenn eine Spielplan-Quelle
ausfällt. Das ist Absicht: Ein halber Kalender wäre schlimmer als ein alter,
weil in der Kalender-App sonst kommentarlos Termine verschwänden.

## Livestream-Einteilung

Bei jedem **Heimspiel** steht im Termin, wer für Regie und Kamera eingeteilt
ist, dazu die Anwesenheitszeit. Die Einteilung kommt aus der per Link
freigegebenen Google-Tabelle (`src/dienstplan.mjs`), zugeordnet über das
Spieldatum, je Mannschaft aus einem eigenen Tabellenblatt.

Damit stehen **Namen von Personen** in einer öffentlich abrufbaren Datei —
so gewollt und so entschieden. Wer das anders halten will:
`OHNE_DIENSTPLAN=1` beim Bau setzen, dann bleibt der Kalender ein reiner
Spielplan. Telefonnummern aus der Tabelle werden in keinem Fall übernommen.

Passt eine Dienstplan-Zeile zu keinem Spiel im offiziellen Plan — etwa weil
ein Spiel verlegt wurde —, steht das als Hinweis im Bau-Protokoll, statt
stillschweigend unterzugehen. Beim ersten Lauf waren das zwei Fälle: das
TSB-Pokalspiel am 21.08.2026 (steht nicht im Ligaspielplan) und NSU–Dortmund,
in der Tabelle am 23.01.2027, offiziell am 20.01.2027.

## Auf welchen Geräten das läuft

- **iPhone/iPad**: `webcal://`-Link antippen, abonnieren, fertig.
- **Android**: einmalig im Browser über Google Kalender hinzufügen
  (`calendar.google.com/calendar/u/0/r/settings/addbyurl`), danach erscheint
  der Kalender in der App. Google holt abonnierte Kalender erfahrungsgemäß nur
  alle paar Stunden bis einmal täglich ab — Änderungen kommen dort also später
  an als auf dem iPhone.
- **Outlook, Thunderbird und andere**: dieselbe Adresse als
  Internetkalender/Abo eintragen.

Die Datei nennt `REFRESH-INTERVAL` und `X-PUBLISHED-TTL` mit 12 Stunden. Das
ist eine Bitte an die Kalender-App, keine Garantie: Jede App entscheidet
selbst, wie oft sie nachsieht.
