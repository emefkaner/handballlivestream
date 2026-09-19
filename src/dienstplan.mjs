// Liest den Livestream-Dienstplan aus der Google-Tabelle und ordnet die
// Besetzung (Regie, Kamera 1, Kamera 2) den Spielterminen zu.
//
// Die Tabelle ist per Link freigegeben, deshalb genügt der CSV-Export ohne
// Anmeldung. Zugeordnet wird über das Spieldatum — je Mannschaft ein eigenes
// Blatt, damit zwei Spiele am selben Tag nicht durcheinandergeraten.

const TABELLE = '1eQQ27YXgbo6HJ8kb1jaroBOOqfT4spv8FCo3j7DOjyw';
const CSV = (blatt) =>
  `https://docs.google.com/spreadsheets/d/${TABELLE}/export?format=csv&gid=${blatt}`;

// Blätter der Saison 2026/27.
const BLAETTER = [
  { fuer: 'tsb', blatt: '1224493051', spalten: { datum: 'Datum', regie: 'Regie', kamera1: 'Kamera 1', gast: 'Gastmannschaft' } },
  { fuer: 'nsu', blatt: '922480219', spalten: { datum: 'Datum', regie: 'Regie', kamera1: 'Kamera 1', kamera2: 'Kamera 2', gast: 'Gastmannschaft', anwesenheit: 'Anwesenheit' } },
];

// Platzhalter der Tabelle für "noch nicht besetzt".
const OFFEN = new Set(['', '...', '?', '??', '???', '-', '–']);

function istOffen(wert) {
  return OFFEN.has(String(wert ?? '').trim());
}

// CSV nach RFC 4180: Felder dürfen Kommas und Zeilenumbrüche in
// Anführungszeichen enthalten — das Datum "Samstag, 29. 08 2026" tut genau das.
export function leseCsv(text) {
  const zeilen = [];
  let zeile = [];
  let feld = '';
  let inAnfuehrung = false;

  for (let i = 0; i < text.length; i += 1) {
    const z = text[i];
    if (inAnfuehrung) {
      if (z === '"') {
        if (text[i + 1] === '"') { feld += '"'; i += 1; }
        else inAnfuehrung = false;
      } else feld += z;
      continue;
    }
    if (z === '"') { inAnfuehrung = true; continue; }
    if (z === ',') { zeile.push(feld); feld = ''; continue; }
    if (z === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; continue; }
    if (z === '\r') continue;
    feld += z;
  }
  if (feld !== '' || zeile.length > 0) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen;
}

// "Samstag, 29. 08 2026" und "Samstag 21.08.2026" -> "2026-08-29".
// Zeitraumangaben wie "22.-24.09.2026" oder "10./11.04.2027" werden bewusst
// übergangen: sie meinen ein Spielfenster, keinen Termin.
export function leseDatum(roh) {
  const text = String(roh ?? '').trim();
  if (!text) return null;
  // "22.-24.09.2026", "11.+12.11.2026", "10./11.04.2027"
  if (/\d\s*\.?\s*[-–/+]\s*\d{1,2}\s*\./.test(text)) return null;

  const treffer = text.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(\d{4})/);
  if (!treffer) return null;
  const [, tag, monat, jahr] = treffer;
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

// Das Kalenderdatum eines Termins in deutscher Ortszeit — der Dienstplan
// denkt in Spieltagen, nicht in UTC.
export function ortsDatum(zeitpunkt) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Berlin',
  }).format(zeitpunkt);
}

function findeSpaltenZeile(zeilen, spalten) {
  for (let i = 0; i < zeilen.length; i += 1) {
    const zeile = zeilen[i].map((z) => z.trim());
    if (zeile.includes(spalten.datum) && zeile.includes(spalten.regie)) {
      return { index: i, kopf: zeile };
    }
  }
  return null;
}

async function holeBlatt(eintrag, protokoll) {
  const antwort = await fetch(CSV(eintrag.blatt), { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
  if (!antwort.ok) {
    throw new Error(`Dienstplan-Blatt ${eintrag.blatt}: ${antwort.status} ${antwort.statusText}`);
  }
  const zeilen = leseCsv(await antwort.text());
  const kopf = findeSpaltenZeile(zeilen, eintrag.spalten);
  if (!kopf) {
    throw new Error(
      `Im Dienstplan-Blatt ${eintrag.blatt} wurde keine Kopfzeile mit "${eintrag.spalten.datum}" und "${eintrag.spalten.regie}" gefunden.`,
    );
  }

  const stelle = (name) => (name ? kopf.kopf.indexOf(name) : -1);
  const spalten = {
    datum: stelle(eintrag.spalten.datum),
    regie: stelle(eintrag.spalten.regie),
    kamera1: stelle(eintrag.spalten.kamera1),
    kamera2: stelle(eintrag.spalten.kamera2),
    gast: stelle(eintrag.spalten.gast),
    anwesenheit: stelle(eintrag.spalten.anwesenheit),
  };

  const nachDatum = new Map();
  for (const zeile of zeilen.slice(kopf.index + 1)) {
    const wert = (nr) => (nr >= 0 && nr < zeile.length ? String(zeile[nr]).trim() : '');
    const datum = leseDatum(wert(spalten.datum));
    if (!datum) continue;

    const besetzung = {
      regie: istOffen(wert(spalten.regie)) ? '' : wert(spalten.regie),
      kamera1: istOffen(wert(spalten.kamera1)) ? '' : wert(spalten.kamera1),
      kamera2: istOffen(wert(spalten.kamera2)) ? '' : wert(spalten.kamera2),
      anwesenheit: istOffen(wert(spalten.anwesenheit)) ? '' : wert(spalten.anwesenheit),
      gast: wert(spalten.gast),
      datum,
    };
    if (!besetzung.regie && !besetzung.kamera1 && !besetzung.kamera2) continue;

    // Bei mehreren Zeilen zum selben Tag gewinnt die erste besetzte.
    if (!nachDatum.has(datum)) nachDatum.set(datum, besetzung);
  }

  protokoll.push(`Dienstplan ${eintrag.fuer.toUpperCase()}: ${nachDatum.size} besetzte Termine gelesen`);
  return nachDatum;
}

export async function holeDienstplan(protokoll = []) {
  const plan = {};
  for (const eintrag of BLAETTER) {
    plan[eintrag.fuer] = await holeBlatt(eintrag, protokoll);
  }
  return plan;
}

// Hängt die Besetzung an die Spiele an und meldet, was nicht zusammenpasst.
export function verknuepfe(spiele, plan, protokoll) {
  const benutzt = { tsb: new Set(), nsu: new Set() };

  for (const spiel of spiele) {
    const blatt = spiel.quelle === 'tsb' ? 'tsb' : 'nsu';
    // Nur Heimspiele werden vom Livestream-Team betreut.
    if (blatt === 'nsu' && !/neckarsulm/i.test(spiel.heim)) continue;

    const datum = ortsDatum(spiel.beginn);
    const besetzung = plan[blatt]?.get(datum);
    if (!besetzung) continue;

    spiel.besetzung = besetzung;
    benutzt[blatt].add(datum);
  }

  for (const blatt of ['tsb', 'nsu']) {
    for (const [datum, besetzung] of plan[blatt] ?? []) {
      if (benutzt[blatt].has(datum)) continue;
      protokoll.push(
        `Hinweis: Dienstplan-Zeile ${blatt.toUpperCase()} vom ${datum}` +
        `${besetzung.gast ? ` (${besetzung.gast})` : ''} passt zu keinem Spiel im offiziellen Spielplan.`,
      );
    }
  }

  const heimspieleOhne = spiele.filter(
    (s) => !s.besetzung && (s.quelle === 'tsb' || /neckarsulm/i.test(s.heim)),
  );
  for (const spiel of heimspieleOhne) {
    protokoll.push(`Hinweis: Für ${ortsDatum(spiel.beginn)} (${spiel.heim} – ${spiel.gast}) steht keine Besetzung im Dienstplan.`);
  }

  return spiele;
}
