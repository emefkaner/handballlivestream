// Baut den Kalender: holt beide Spielpläne, gleicht den Livestream-Dienstplan
// ab und schreibt die .ics-Dateien samt Anleitungsseite nach site/.
//
// Grundsatz: Fällt eine der Spielplan-Quellen aus, bricht der Lauf ab, ohne
// etwas zu schreiben. Ein halber Kalender wäre schlimmer als ein alter —
// in der Kalender-App verschwänden sonst kommentarlos Termine.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { holeHuntersHeimspiele, holeNeckarsulmSpiele } from './quellen.mjs';
import { holeDienstplan, verknuepfe } from './dienstplan.mjs';
import { mannschaftsName, ligaKurz } from './namen.mjs';
import { baueKalender } from './ics.mjs';
import { baueSeite } from './seite.mjs';

const KENNZEICHEN = 'handballlivestream.emefkaner.github.io';
const AUSGABE = new URL('../docs/', import.meta.url).pathname;

const SPIELPLAN_DATEI = 'handball.ics';

const NAME_SPIELPLAN = 'Handball-Livestreams-Unterland (emefka)';
const BESCHREIBUNG_SPIELPLAN =
  'Alle Heimspiele der TSB Hunters (3. Liga Süd) und alle Spiele der Sport-Union Neckarsulm ' +
  '(Damen, 1. Bundesliga und DHB-Pokal). Bei den Heimspielen steht die Einteilung des ' +
  'Livestream-Teams im Termin. Wird zweimal täglich automatisch aktualisiert.';

// Im Kalender steht immer die eigene Mannschaft zuerst, dann der Gegner —
// auch auswärts. Dafür muss der Bau wissen, welche der beiden die eigene ist,
// und das Ergebnis entsprechend herumdrehen.
function aufbereiten(spiel) {
  const daheim = spiel.quelle === 'tsb' ? true : /neckarsulm/i.test(spiel.heim);
  const heim = mannschaftsName(spiel.heim);
  const gast = mannschaftsName(spiel.gast);

  return {
    ...spiel,
    heim,
    gast,
    liga: ligaKurz(spiel.liga),
    eigene: spiel.quelle === 'tsb' ? 'TSB' : 'SUN',
    gegner: daheim ? gast : heim,
    daheim,
    pokal: spiel.quelle === 'hbf-pokal',
    toreEigene: daheim ? spiel.toreHeim : spiel.toreGast,
    toreGegner: daheim ? spiel.toreGast : spiel.toreHeim,
  };
}

async function main() {
  const protokoll = [];
  const gebautAm = new Date();

  const huntersHeimspiele = await holeHuntersHeimspiele(protokoll);
  const { spiele: nsuSpiele, saison } = await holeNeckarsulmSpiele(protokoll, gebautAm);

  if (huntersHeimspiele.length === 0) {
    throw new Error('Die TSB-Schnittstelle hat kein einziges Heimspiel geliefert — Bau abgebrochen.');
  }
  if (nsuSpiele.length === 0) {
    throw new Error(`Für Neckarsulm wurde in der Saison ${saison} kein Spiel gefunden — Bau abgebrochen.`);
  }

  const spiele = [
    ...huntersHeimspiele.map((s) => ({ ...aufbereiten(s), kategorie: 'TSB Hunters' })),
    ...nsuSpiele.map((s) => ({ ...aufbereiten(s), kategorie: 'SU Neckarsulm' })),
  ].sort((a, b) => a.beginn - b.beginn);

  // Die Einteilung ist eine Zutat, kein Fundament: fällt die Tabelle aus,
  // entsteht trotzdem ein vollständiger Spielplan-Kalender.
  // OHNE_DIENSTPLAN=1 lässt sie bewusst weg — dann steht in keiner erzeugten
  // Datei der Name einer Person.
  let dienstplanSteht = false;
  try {
    if (process.env.OHNE_DIENSTPLAN === '1') throw new Error('per OHNE_DIENSTPLAN=1 abgeschaltet');
    const plan = await holeDienstplan(protokoll);
    verknuepfe(spiele, plan, protokoll);
    dienstplanSteht = true;
  } catch (fehler) {
    protokoll.push(`Ohne Livestream-Einteilung: ${fehler.message}`);
  }

  await mkdir(AUSGABE, { recursive: true });

  await writeFile(
    join(AUSGABE, SPIELPLAN_DATEI),
    baueKalender({
      name: NAME_SPIELPLAN,
      beschreibung: BESCHREIBUNG_SPIELPLAN,
      spiele,
      gebautAm,
      kennzeichen: KENNZEICHEN,
      mitBesetzung: dienstplanSteht,
    }),
    'utf8',
  );

  await writeFile(
    join(AUSGABE, 'index.html'),
    baueSeite({
      spiele,
      gebautAm,
      saison,
      dateiname: SPIELPLAN_DATEI,
      mitBesetzung: dienstplanSteht,
      name: NAME_SPIELPLAN,
    }),
    'utf8',
  );
  // Verhindert, dass GitHub Pages die Seite durch Jekyll schickt.
  await writeFile(join(AUSGABE, '.nojekyll'), '', 'utf8');

  for (const zeile of protokoll) console.log(zeile);
  const mitBesetzung = spiele.filter((s) => s.besetzung).length;
  console.log(`\nGeschrieben: docs/${SPIELPLAN_DATEI}`);
  console.log(`Termine gesamt: ${spiele.length} (TSB-Heimspiele: ${huntersHeimspiele.length}, Neckarsulm: ${nsuSpiele.length})`);
  console.log(`Davon mit Livestream-Besetzung: ${mitBesetzung}`);
  const naechstes = spiele.find((s) => s.beginn > gebautAm);
  if (naechstes) {
    console.log(`Nächster Termin: ${naechstes.beginn.toISOString()} ${naechstes.heim} – ${naechstes.gast}`);
  }
}

main().catch((fehler) => {
  console.error(`Bau fehlgeschlagen: ${fehler.message}`);
  process.exit(1);
});
