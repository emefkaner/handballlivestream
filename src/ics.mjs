// Erzeugt eine iCalendar-Datei (RFC 5545) aus den eingesammelten Spielen.

// Ein Handballspiel dauert 2 x 30 Minuten plus Halbzeitpause. Mit Ein- und
// Auslauf sind zwei Stunden eine ehrliche Annahme; die Quellen nennen kein
// Spielende.
export const SPIELDAUER_MINUTEN = 120;

const ZEILENENDE = '\r\n';

function zeitstempel(datum) {
  return datum.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Zeilen dürfen 75 Oktette nicht überschreiten; Fortsetzungen beginnen mit
// einem Leerzeichen. Gezählt wird in Bytes, sonst zerreißt es Umlaute.
function falte(zeile) {
  const zeichen = [...zeile];
  const teile = [];
  let aktuell = '';
  let bytes = 0;

  for (const z of zeichen) {
    const laenge = Buffer.byteLength(z, 'utf8');
    const grenze = teile.length === 0 ? 75 : 74; // Fortsetzung hat ein Leerzeichen vorweg
    if (bytes + laenge > grenze) {
      teile.push(aktuell);
      aktuell = '';
      bytes = 0;
    }
    aktuell += z;
    bytes += laenge;
  }
  teile.push(aktuell);
  return teile.join(`${ZEILENENDE} `);
}

function maskiere(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function feld(name, wert) {
  return falte(`${name}:${maskiere(wert)}`);
}

export function baueKalender({ name, beschreibung, spiele, gebautAm = new Date(), kennzeichen, mitBesetzung = false }) {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${kennzeichen}//Handball-Kalender//DE`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    feld('X-WR-CALNAME', name),
    feld('NAME', name),
    feld('X-WR-CALDESC', beschreibung),
    feld('DESCRIPTION', beschreibung),
    'X-WR-TIMEZONE:Europe/Berlin',
    // Bitte an die Kalender-App, zweimal täglich nachzusehen.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];

  for (const spiel of spiele) {
    zeilen.push(...baueTermin(spiel, gebautAm, kennzeichen, mitBesetzung));
  }

  zeilen.push('END:VCALENDAR');
  return zeilen.join(ZEILENENDE) + ZEILENENDE;
}

function baueTermin(spiel, gebautAm, kennzeichen, mitBesetzung) {
  const ende = new Date(spiel.beginn.getTime() + SPIELDAUER_MINUTEN * 60_000);
  const zeilen = [
    'BEGIN:VEVENT',
    feld('UID', `${spiel.quelle}-${spiel.kennung}@${kennzeichen}`),
    `DTSTAMP:${zeitstempel(gebautAm)}`,
    `DTSTART:${zeitstempel(spiel.beginn)}`,
    `DTEND:${zeitstempel(ende)}`,
    feld('SUMMARY', titel(spiel)),
  ];

  if (spiel.ort) zeilen.push(feld('LOCATION', spiel.ort));
  zeilen.push(feld('DESCRIPTION', beschreibungText(spiel, mitBesetzung)));
  if (spiel.web) zeilen.push(feld('URL', spiel.web));
  zeilen.push(feld('CATEGORIES', spiel.kategorie || 'Handball'));
  zeilen.push(`STATUS:${spiel.abgesagt ? 'CANCELLED' : 'CONFIRMED'}`);
  zeilen.push('TRANSP:OPAQUE');
  zeilen.push('END:VEVENT');
  return zeilen;
}

// Genau "TSB gegen HSG Albstadt" bzw. "SUN gegen TuS Metzingen". Ergebnis,
// Spieltag und Halle stehen in der Beschreibung des Termins, damit der Titel
// auf dem Sperrbildschirm vollständig lesbar bleibt.
//
// Zwei Zusätze bleiben: Pokalspiele werden als solche gekennzeichnet, weil
// sie aus der Reihe fallen, und eine Absage steht vorn — wer nur die
// Terminliste überfliegt, soll nicht umsonst zur Halle fahren.
// In den persönlichen Kalendern steht zusätzlich die eigene Aufgabe (`rolle`),
// damit man auf einen Blick weiß, ob man an der Regie oder an der Kamera ist.
export function titel(spiel) {
  const zusaetze = [];
  if (spiel.pokal) zusaetze.push('DHB-Pokal');
  if (spiel.rolle) zusaetze.push(spiel.rolle);

  const kern = `${spiel.eigene} gegen ${spiel.gegner}` +
    (zusaetze.length > 0 ? ` (${zusaetze.join(', ')})` : '');
  return spiel.abgesagt ? `ABGESAGT: ${kern}` : kern;
}

function beschreibungText(spiel, mitBesetzung) {
  const zeilen = [];
  // Hier steht die Paarung in der üblichen Lesart, damit man auch sieht,
  // wer Gastgeber ist.
  zeilen.push(`${spiel.heim} – ${spiel.gast}`);
  if (spiel.ligaLang) zeilen.push(spiel.ligaLang);
  if (spiel.spieltag) zeilen.push(`Spieltag ${spiel.spieltag}`);
  if (spiel.ort) zeilen.push(`Halle: ${spiel.ort}`);
  if (spiel.abgesagt) zeilen.push('Dieses Spiel wurde abgesagt.');
  else if (spiel.gespielt && Number.isFinite(spiel.toreHeim) && Number.isFinite(spiel.toreGast)) {
    // In der Beschreibung bleibt die übliche Lesart Heim:Gast.
    zeilen.push(`Endstand: ${spiel.heim} ${spiel.toreHeim}:${spiel.toreGast} ${spiel.gast}`);
  }
  if (mitBesetzung && spiel.besetzung) {
    zeilen.push('', 'Livestream-Team');
    if (spiel.besetzung.regie) zeilen.push(`Regie: ${spiel.besetzung.regie}`);
    if (spiel.besetzung.kamera1) zeilen.push(`Kamera 1: ${spiel.besetzung.kamera1}`);
    if (spiel.besetzung.kamera2) zeilen.push(`Kamera 2: ${spiel.besetzung.kamera2}`);
    if (spiel.besetzung.anwesenheit) zeilen.push(`Anwesenheit: ${spiel.besetzung.anwesenheit}`);
  }
  if (spiel.web) zeilen.push(`Quelle: ${spiel.web}`);
  return zeilen.join('\n');
}
