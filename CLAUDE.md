# Arbeitsweise in diesem Projekt

## Was das hier ist

Ein Generator, der aus drei öffentlichen Quellen abonnierbare iCal-Kalender
baut und sie zweimal täglich über GitHub Actions ins eigene Repo schreibt.
Kein Server, keine laufenden Kosten.

Enthalten sind **nur Heimspiele** — die Spiele, bei denen das Livestream-Team
im Einsatz ist:

- 15 Heimspiele der **TSB Hunters** (TSB Heilbronn-Horkheim, 3. Liga Süd)
- 11 Heimspiele der **Sport-Union Neckarsulm** (Damen, 1. Bundesliga, dazu
  DHB-Pokal-Heimspiele, sobald es welche gibt)

Bei jedem Spiel steht im Termin, wer für Regie und Kamera eingeteilt ist.

## Nicht raten — überprüfen

Vermutungen führen hier regelmäßig in die Irre. Deshalb:

1. **Vor jeder Behauptung prüfen.** Die Datei tatsächlich abrufen, die Antwort
   der Schnittstelle ansehen, den Lauf im Protokoll nachlesen — statt aus dem
   Gedächtnis zu schließen.
2. **Im Browser testen, was im Browser läuft** (die Übersichtsseite).
3. **Unsicherheit benennen.** Was nicht überprüft werden konnte, klar sagen.

## Adressen zum Abonnieren

| Kalender | Adresse (alle unter `…/handballlivestream/main/docs/`) |
|---|---|
| Alle Heimspiele | `handball.ics` |
| Oliver Amann | `oliver-amann.ics` |
| Andreas Krieger | `andreas-krieger.ics` |
| Markus Krieger | `markus-krieger.ics` |
| Tanja Krieger | `tanja-krieger.ics` |

Vollständig, am Beispiel des Gesamtkalenders:

```
https://raw.githubusercontent.com/emefkaner/handballlivestream/main/docs/handball.ics
```

**Warum raw.githubusercontent und nicht GitHub Pages:** Pages ließ sich nicht
einrichten — die Action bricht mit `Create Pages site failed. Resource not
accessible by integration` ab (ein Workflow-Token darf das grundsätzlich
nicht), und in den Repo-Einstellungen war die Auswahl für den Besitzer nicht
auffindbar. Deshalb committet der Lauf das Ergebnis selbst nach `docs/`. Die
raw-Adresse ist nach spätestens fünf Minuten aktuell (`max-age=300`).

GitHub liefert sie als `text/plain` statt `text/calendar`. Apple und Google
nehmen sie trotzdem an. Falls doch eine App streikt, gibt es dieselbe Datei
über `https://cdn.jsdelivr.net/gh/emefkaner/handballlivestream@main/docs/…` —
richtig gekennzeichnet, aber bis zu **sieben Tage** hinter dem Stand
(`max-age=604800`), deshalb nur als Rückfall.

Der Pages-Weg bleibt im Workflow stehen, scheitert aber still
(`continue-on-error`). Wird Pages irgendwann doch eingerichtet, läuft er
einfach mit.

## Woher die Daten kommen

| Quelle | Was | Wie |
|---|---|---|
| `webapi.tsb-horkheim-hunters.de/api/handball-matches` | Spielplan TSB | Strapi hinter der Vereinsseite. Der Lese-Schlüssel steht im ausgelieferten JavaScript von `tsb-horkheim-hunters.de/calendar` und wird bei **jedem Lauf frisch von dort geholt** (`holeTsbZugang()`). Er liegt bewusst **nicht** im Repo — einmal hat der Sicherheitswächter zu Recht blockiert, als er im Quelltext stehen sollte. |
| `hbf-cms.deinsportplatz.de/data/leagues/league_<Saison>.json` | Spielplan HBF | Statische Dateien hinter `alsco-hbf.de` (früher `hbf-info.de`). |
| Google-Tabelle (per Link freigegeben) | Livestream-Einteilung | CSV-Export ohne Anmeldung, je Mannschaft ein Blatt: TSB `gid=1224493051`, Neckarsulm `gid=922480219`. |

Beide Spielplanquellen nennen die Anwurfzeit in **UTC**; der Kalender übernimmt
das unverändert, damit Sommer- und Winterzeit von selbst stimmen.

**Die Saison sucht sich der Bau selbst.** Jede HBF-Spielplandatei führt unter
`seasons` auch alle anderen Saisons auf; gesucht wird die laufende (ab Juli
zählt das neue Saisonjahr). Damit bleibt der Kalender im nächsten Sommer nicht
stillschweigend leer. Findet er sie nicht, nimmt er die hinterlegte Saison und
schreibt eine Warnung ins Protokoll.

## Aufbau

```
src/quellen.mjs     Spielpläne holen (TSB + HBF), Saison bestimmen
src/dienstplan.mjs  Google-Tabelle lesen, Besetzung dem Spieldatum zuordnen
src/personen.mjs    wer einen eigenen Kalender bekommt, wer wann eingeteilt ist
src/namen.mjs       Mannschaftsnamen lesbar machen ("HSG ALBSTADT" -> "HSG Albstadt")
src/ics.mjs         iCalendar erzeugen (RFC 5545: CRLF, Zeilenfaltung, Maskierung)
src/seite.mjs       Übersichtsseite docs/index.html
src/build.mjs       alles zusammensetzen, nach docs/ schreiben
test/pruefe.mjs     Prüfungen ohne Netzzugriff
```

```bash
npm run build   # schreibt docs/ (braucht Netz)
npm test        # prüft die Bausteine und die erzeugte Datei
```

Es gibt **keine Abhängigkeiten** — reines Node (ab Version 22, wegen `fetch`
und `AbortSignal.timeout`).

## Regeln, die im Code stecken

- **Termintitel**: genau `TSB gegen <Gegner>` bzw. `SUN gegen <Gegner>`. Vom
  Nutzer so vorgegeben, mehrfach nachgeschärft. Zwei Zusätze sind erlaubt:
  `(DHB-Pokal)` dahinter und `ABGESAGT:` davor. **Kein Ergebnis im Titel** —
  das steht in der Beschreibung. In den persönlichen Kalendern kommt die eigene
  Aufgabe dazu: `TSB gegen HSG Albstadt (Kamera 1)`.
- **Kalendername**: `Handball-Livestreams-Unterland (emefka)`. Ändert man ihn,
  übernimmt iOS das bei einem bestehenden Abo **nicht** — dann muss neu
  abonniert werden.
- **Nur Heimspiele.** Auswärtsspiele fallen raus, in Liga wie Pokal.
- **Spieldauer**: zwei Stunden ab Anpfiff (`SPIELDAUER_MINUTEN`). Die Quellen
  nennen kein Spielende; das ist eine begründete Annahme, keine Tatsache.
- **Fällt eine Spielplanquelle aus, bricht der Bau ab, ohne etwas zu
  schreiben.** Ein halber Kalender wäre schlimmer als ein alter: In der
  Kalender-App verschwänden sonst kommentarlos Termine. Fällt dagegen nur die
  Dienstplan-Tabelle aus, entsteht der Kalender trotzdem — dann ohne
  Einteilung.
- **Personennamen stehen in einer öffentlich abrufbaren Datei.** Das ist die
  ausdrückliche Entscheidung des Repo-Eigentümers, nachdem der Punkt
  angesprochen wurde. `OHNE_DIENSTPLAN=1` baut jederzeit einen reinen
  Spielplan ohne Namen, ohne dass sich die Abo-Adresse ändert. Telefonnummern
  aus der Tabelle werden **nie** übernommen.

## Fallen, die schon zugeschlagen haben

- **`docs/` erzeugt Rebase-Konflikte.** Der Actions-Lauf committet dorthin,
  die Arbeitskopie auch. Vor jedem Push `git pull --rebase origin main`; bei
  Konflikt in `docs/` **nicht von Hand mergen**, sondern `npm run build`,
  `git add -f docs`, `git rebase --continue`. Am einfachsten: lokal `docs/`
  gar nicht committen und dem Lauf überlassen.
- **`docs/` nicht in `.gitignore` setzen.** Das war ein Fehlgriff: Die Dateien
  sind versioniert (müssen sie sein, sonst gibt es die Abo-Adresse nicht), und
  der Eintrag blockiert nur noch `git add`.
- **Der Zeitplan läuft, aber unpünktlich.** Eingetragen ist `25 4,15 * * *`
  (6:25 und 17:25 Ortszeit). Tatsächlich feuert GitHub vier bis fünf Stunden
  später — beobachtet: 09:21, 10:04, 18:13, 18:59, 20:02 UTC. Geplante Läufe
  haben dort niedrige Priorität. Wenn das stört: mehr Cron-Zeiten eintragen
  (etwa alle vier Stunden), dann fängt der nächste Slot einen verpassten auf.
  Ein Lauf dauert 15–20 Sekunden und ist bei öffentlichen Repos kostenlos.
- **Zeitpläne schaltet GitHub nach 60 Tagen ohne Repo-Aktivität ab** und
  schickt vorher eine Mail. Dann unter „Actions" auf **Enable workflow**
  klicken.
- **Abweichungen zwischen Dienstplan und offiziellem Spielplan** werden im
  Bau-Protokoll gemeldet, statt unterzugehen. Zwei bekannte Fälle: das
  TSB-Pokalspiel am 21.08.2026 gegen TVB Stuttgart (steht in keinem
  Ligaspielplan) und NSU–Dortmund, in der Tabelle am 23.01.2027, offiziell am
  20.01.2027.
- **Die Kalender-App holt nicht sofort nach.** Ändert sich etwas, steht es
  binnen Minuten in der Datei — auf dem Gerät aber erst, wenn die App nachsieht
  (iOS stündlich bis täglich, Google oft erst nach Stunden). Am iPhone erzwingt
  man es in der Kalender-App mit Ziehen nach unten.

## Sprache

Antworten und Commit-Nachrichten auf Deutsch.
