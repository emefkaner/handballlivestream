# Handball-Kalender zum Abonnieren

Erzeugt eine iCal-Datei mit

- allen **Heimspielen der TSB Hunters** (TSB Heilbronn-Horkheim, 3. Liga Süd) und
- allen **Heimspielen der Sport-Union Neckarsulm** (Damen, 1. Bundesliga und DHB-Pokal).

Es stehen ausschließlich Heimspiele drin — die Spiele, bei denen gestreamt
wird. Auswärtsspiele lässt der Bau weg, in Liga wie Pokal. Kommt Neckarsulm im
Pokal weiter und bekommt ein Heimrecht, taucht das Spiel von allein auf.

Ein GitHub-Actions-Lauf baut die Datei zweimal täglich neu und legt sie unter
`docs/` im Repo ab. Kalender-Apps holen sich Änderungen von allein — kein
Server, keine laufenden Kosten.

## Die Abo-Adresse

```
https://raw.githubusercontent.com/emefkaner/handballlivestream/main/docs/handball.ics
```

Weil der Lauf die fertige Datei selbst committet, braucht es **kein** GitHub
Pages: Die Adresse funktioniert sofort und ist nach spätestens fünf Minuten auf
dem neuesten Stand (`cache-control: max-age=300`).

GitHub liefert sie allerdings als `text/plain` statt `text/calendar`. Nimmt
eine Kalender-App sie deshalb nicht an, hilft dieselbe Datei über jsDelivr:

```
https://cdn.jsdelivr.net/gh/emefkaner/handballlivestream@main/docs/handball.ics
```

Die ist korrekt gekennzeichnet, hält eine Änderung aber bis zu sieben Tage
zurück (`max-age=604800`) — für kurzfristige Absagen also der schlechtere Weg.

Ist GitHub Pages eingerichtet (Source: GitHub Actions), veröffentlicht der Lauf
zusätzlich unter `https://emefkaner.github.io/handballlivestream/` — mit
richtigem Inhaltstyp *und* kurzer Cache-Zeit. Scheitert das, läuft der Rest
trotzdem durch; der Pages-Schritt darf fehlschlagen, ohne den Kalender
aufzuhalten.

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

- **Titel**: `TSB gegen HSG Albstadt` bzw. `SUN gegen TuS Metzingen` — sonst
  nichts, damit er auf dem Sperrbildschirm ganz zu lesen ist. Zwei Zusätze
  gibt es: Pokalspiele bekommen `(DHB-Pokal)` dahinter, eine Absage steht als
  `ABGESAGT:` davor. Ergebnis, Spieltag und Halle stehen in der Beschreibung
  des Termins.
- **Dauer**: zwei Stunden ab Anpfiff. Die Quellen nennen kein Spielende;
  2 × 30 Minuten plus Pause und Ein-/Auslauf sind die ehrliche Schätzung
  (`SPIELDAUER_MINUTEN` in `src/ics.mjs`).
- **Ort**: nur, wenn die Quelle einen nennt — bei den Hunters die Stauwehrhalle,
  bei Neckarsulm liefern die Daten keine Halle.

## Selbst bauen

```bash
npm run build     # schreibt docs/
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
