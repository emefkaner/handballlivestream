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

function titel(spiel) {
  const kern = `${spiel.heim} – ${spiel.gast}`;
  const zusatz = spiel.liga ? ` (${spiel.liga})` : '';
  if (spiel.abgesagt) return `ABGESAGT: ${kern}${zusatz}`;
  if (spiel.gespielt && Number.isFinite(spiel.toreHeim) && Number.isFinite(spiel.toreGast)) {
    return `${kern} ${spiel.toreHeim}:${spiel.toreGast}${zusatz}`;
  }
  return `${kern}${zusatz}`;
}

function beschreibungText(spiel, mitBesetzung) {
  const zeilen = [];
  if (spiel.ligaLang) zeilen.push(spiel.ligaLang);
  if (spiel.spieltag) zeilen.push(`Spieltag ${spiel.spieltag}`);
  if (spiel.ort) zeilen.push(`Halle: ${spiel.ort}`);
  if (spiel.abgesagt) zeilen.push('Dieses Spiel wurde abgesagt.');
  else if (spiel.gespielt && Number.isFinite(spiel.toreHeim) && Number.isFinite(spiel.toreGast)) {
    zeilen.push(`Endstand: ${spiel.toreHeim}:${spiel.toreGast}`);
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
