// Prüfungen ohne Netzzugriff: die Bausteine für sich, und die erzeugte
// Kalenderdatei, falls schon eine gebaut wurde.

import { readFileSync, existsSync } from 'node:fs';
import { baueKalender, titel, SPIELDAUER_MINUTEN } from '../src/ics.mjs';
import { leseCsv, leseDatum, ortsDatum } from '../src/dienstplan.mjs';
import { mannschaftsName, ligaKurz } from '../src/namen.mjs';
import { saisonBezeichnung } from '../src/quellen.mjs';
import { PERSONEN, aufgabeIm, spieleVon } from '../src/personen.mjs';

let fehler = 0;

function pruefe(behauptung, wahr) {
  if (wahr) {
    console.log(`  ok  ${behauptung}`);
  } else {
    console.error(`  FEHLER  ${behauptung}`);
    fehler += 1;
  }
}

function gleich(behauptung, ist, soll) {
  pruefe(`${behauptung} (${JSON.stringify(ist)})`, ist === soll);
  if (ist !== soll) console.error(`          erwartet: ${JSON.stringify(soll)}`);
}

console.log('Namen');
gleich('Versalien werden lesbar', mannschaftsName('HSG ALBSTADT'), 'HSG Albstadt');
gleich('VFL wird zu VfL', mannschaftsName('VFL PFULLINGEN'), 'VfL Pfullingen');
gleich('Zweite Mannschaften behalten die II', mannschaftsName('HC ERLANGEN II'), 'HC Erlangen II');
gleich('Gemischte Schreibweise bleibt', mannschaftsName('Wölfe Würzburg'), 'Wölfe Würzburg');
gleich('TSB heißt im Kalender Hunters', mannschaftsName('TSB Heilbronn-Horkheim'), 'TSB Hunters');
gleich('Neckarsulm wird gekürzt', mannschaftsName('Sport-Union Neckarsulm '), 'SU Neckarsulm');
gleich('Liga wird gekürzt', ligaKurz('3. Liga Männer - Süd'), '3. Liga Süd');

console.log('Saison');
gleich('September gehört zur neuen Saison', saisonBezeichnung(new Date('2026-09-19T12:00:00Z')), '2026/2027');
gleich('März gehört noch zur alten', saisonBezeichnung(new Date('2027-03-01T12:00:00Z')), '2026/2027');
gleich('Juli beginnt die nächste', saisonBezeichnung(new Date('2027-07-01T12:00:00Z')), '2027/2028');

console.log('Dienstplan-Bausteine');
const csv = leseCsv('a,b\n"Samstag, 29. 08 2026",x\n');
gleich('Komma im Anführungszeichen zerreißt das Feld nicht', csv[1][0], 'Samstag, 29. 08 2026');
gleich('Datum mit Leerzeichen', leseDatum('Samstag, 29. 08 2026'), '2026-08-29');
gleich('Datum mit Punkten', leseDatum('Samstag 21.08.2026'), '2026-08-21');
gleich('Zeitraum ergibt keinen Termin', leseDatum('22.-24.09.2026'), null);
gleich('Zeitraum mit Schrägstrich ebenso', leseDatum('10./11.04.2027'), null);
gleich('Spätabend zählt zum deutschen Kalendertag', ortsDatum(new Date('2026-12-05T19:00:00Z')), '2026-12-05');

console.log('Persönliche Kalender');
const oliver = PERSONEN.find((p) => p.name === 'Oliver Amann');
const tanja = PERSONEN.find((p) => p.name === 'Tanja Krieger');
const einsatz = {
  besetzung: { regie: 'emefka', kamera1: 'Tanja Krieger', kamera2: 'Oliver Amann' },
};
gleich('findet die eigene Aufgabe', aufgabeIm(einsatz, oliver), 'Kamera 2');
gleich('und die der anderen', aufgabeIm(einsatz, tanja), 'Kamera 1');
gleich('wer nicht eingeteilt ist, bekommt nichts',
  aufgabeIm({ besetzung: { regie: 'emefka' } }, oliver), null);
gleich('Schreibweise ohne Rücksicht auf Groß- und Kleinschreibung',
  aufgabeIm({ besetzung: { regie: '  oliver amann ' } }, oliver), 'Regie');
gleich('doppelte Einteilung nennt beide Aufgaben',
  aufgabeIm({ besetzung: { regie: 'Oliver Amann', kamera1: 'Oliver Amann' } }, oliver),
  'Regie + Kamera 1');
gleich('ohne Dienstplan kein Einsatz', aufgabeIm({}, oliver), null);

const auswahl = spieleVon(
  [
    { kennung: 'a', besetzung: { regie: 'Oliver Amann' } },
    { kennung: 'b', besetzung: { regie: 'emefka', kamera1: 'Tanja Krieger' } },
    { kennung: 'c' },
  ],
  oliver,
);
gleich('nimmt nur die eigenen Spiele', auswahl.length, 1);
gleich('und merkt sich die Aufgabe', auswahl[0].rolle, 'Regie');
gleich('die Aufgabe steht im Titel',
  titel({ eigene: 'TSB', gegner: 'HSG Albstadt', rolle: 'Kamera 1' }),
  'TSB gegen HSG Albstadt (Kamera 1)');

console.log('Kalenderdatei');
const beispiel = [{
  quelle: 'test',
  kennung: '1',
  beginn: new Date('2026-10-03T18:00:00Z'),
  heim: 'TSB Hunters',
  gast: 'TSV Neuhausen/Filder',
  eigene: 'TSB',
  gegner: 'TSV Neuhausen/Filder',
  daheim: true,
  pokal: false,
  liga: '3. Liga Süd',
  ligaLang: '3. Liga Männer - Süd',
  ort: 'Stauwehrhalle',
  abgesagt: false,
  gespielt: false,
  kategorie: 'TSB Hunters',
  web: 'https://example.org/',
}];
const ics = baueKalender({ name: 'Test', beschreibung: 'Test', spiele: beispiel, kennzeichen: 'test', gebautAm: new Date('2026-09-19T10:00:00Z') });

pruefe('beginnt mit BEGIN:VCALENDAR', ics.startsWith('BEGIN:VCALENDAR\r\n'));
pruefe('endet mit END:VCALENDAR', ics.trimEnd().endsWith('END:VCALENDAR'));
pruefe('nutzt durchgehend CRLF', ics.split('\n').every((z, i, alle) => i === alle.length - 1 || z.endsWith('\r')));
pruefe('enthält den Anpfiff als UTC', ics.includes('DTSTART:20261003T180000Z'));
gleich('Spieldauer ist gesetzt', SPIELDAUER_MINUTEN, 120);
pruefe('setzt das Ende zwei Stunden später', ics.includes('DTEND:20261003T200000Z'));
pruefe('keine Namen ohne ausdrücklichen Wunsch', !ics.includes('Regie:'));

console.log('Titel');
gleich('genau "TSB gegen <Gegner>"',
  titel({ eigene: 'TSB', gegner: 'HSG Albstadt', daheim: true }),
  'TSB gegen HSG Albstadt');
gleich('genau "SUN gegen <Gegner>"',
  titel({ eigene: 'SUN', gegner: 'TuS Metzingen', daheim: true }),
  'SUN gegen TuS Metzingen');
gleich('Pokalspiele stehen in Klammern dahinter',
  titel({ eigene: 'SUN', gegner: 'Buxtehuder SV', daheim: true, pokal: true }),
  'SUN gegen Buxtehuder SV (DHB-Pokal)');
gleich('das Ergebnis bleibt aus dem Titel heraus',
  titel({ eigene: 'SUN', gegner: 'Borussia Dortmund', daheim: true, gespielt: true, toreEigene: 33, toreGegner: 35 }),
  'SUN gegen Borussia Dortmund');
gleich('nur eine Absage wird im Titel genannt',
  titel({ eigene: 'TSB', gegner: 'HSG Konstanz', daheim: true, abgesagt: true }),
  'ABGESAGT: TSB gegen HSG Konstanz');

// Gefaltete Zeilen: keine Zeile über 75 Oktette.
for (const zeile of ics.split('\r\n')) {
  if (Buffer.byteLength(zeile, 'utf8') > 75) {
    pruefe(`Zeile zu lang: ${zeile.slice(0, 40)}…`, false);
    break;
  }
}
pruefe('alle Zeilen halten die Längengrenze ein', ics.split('\r\n').every((z) => Buffer.byteLength(z, 'utf8') <= 75));

const gebaut = new URL('../docs/handball.ics', import.meta.url).pathname;
if (existsSync(gebaut)) {
  console.log('Gebaute Datei');
  const inhalt = readFileSync(gebaut, 'utf8');
  const termine = inhalt.match(/BEGIN:VEVENT/g)?.length ?? 0;
  pruefe(`enthält Termine (${termine})`, termine > 0);
  const uids = [...inhalt.matchAll(/^UID:(.+)$/gm)].map((t) => t[1].trim());
  pruefe('alle Kennungen sind eindeutig', new Set(uids).size === uids.length);
  pruefe('BEGIN und END halten sich die Waage',
    (inhalt.match(/BEGIN:VEVENT/g) || []).length === (inhalt.match(/END:VEVENT/g) || []).length);
  pruefe('jede Zeile hält die Längengrenze ein',
    inhalt.split('\r\n').every((z) => Buffer.byteLength(z, 'utf8') <= 75));
}

if (fehler > 0) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Prüfungen bestanden.');
