// Mannschafts- und Liganamen so aufbereiten, dass sie in der Kalender-App
// lesbar sind. Auf dem Sperrbildschirm sind nur rund 30 Zeichen zu sehen —
// deshalb kurz und die eigene Mannschaft zuerst erkennbar.

// Abkürzungen, die in Versalien bleiben müssen.
const ABKUERZUNGEN = new Set([
  'TSB', 'TSV', 'TV', 'TG', 'SG', 'SV', 'HC', 'HSG', 'HBW', 'VfL', 'VfB', 'FC', 'SC',
  'BSV', 'MTV', 'TUS', 'TuS', 'HSV', 'DJK', 'II', 'III', 'HB', 'SU', 'ESV', 'VfV',
]);

// Schreibweisen, die die Quellen falsch oder unnötig lang liefern.
const ERSETZUNGEN = new Map([
  ['TSB Heilbronn-Horkheim', 'TSB Hunters'],
  ['Sport-Union Neckarsulm', 'SU Neckarsulm'],
  ['Neckarsulmer Sport-Union', 'SU Neckarsulm'],
  // Die Quelle schreibt "FRISCH AUF Göppingen"; das kurze "AUF" rutscht
  // sonst als vermeintliches Kürzel durch die Versalien-Regel.
  ['Frisch AUF Göppingen', 'Frisch Auf Göppingen'],
  ['VFL', 'VfL'],
  ['VFB', 'VfB'],
  ['TUS', 'TuS'],
]);

// "HSG ALBSTADT" -> "HSG Albstadt", "Wölfe Würzburg" bleibt unangetastet.
// Getrennt wird auch an "/" und "-", damit "NEUHAUSEN/Filder" nicht als ein
// bereits gemischtes Wort durchrutscht.
function entversale(name) {
  return name
    .split(/(?<=[\s/])|(?=[\s/])/)
    .map((wort) => {
      if (/^[\s/]+$/.test(wort)) return wort;
      if (wort !== wort.toUpperCase()) return wort; // schon gemischt: in Ruhe lassen
      if (ABKUERZUNGEN.has(wort)) return wort;
      if (ERSETZUNGEN.has(wort)) return ERSETZUNGEN.get(wort);
      if (wort.replace(/[^A-ZÄÖÜ]/g, '').length <= 3) return wort; // kurze Kürzel bleiben
      return wort
        .toLowerCase()
        .replace(/(^|[\s\-/.])([a-zäöüß])/g, (_, davor, buchstabe) => davor + buchstabe.toUpperCase());
    })
    .join('');
}

export function mannschaftsName(roh) {
  const name = String(roh ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  if (ERSETZUNGEN.has(name)) return ERSETZUNGEN.get(name);
  const entversalt = entversale(name);
  return ERSETZUNGEN.get(entversalt) ?? entversalt;
}

// "3. Liga Männer - Süd" -> "3. Liga Süd"
export function ligaKurz(roh) {
  const name = String(roh ?? '').replace(/\s+/g, ' ').trim();
  if (/^3\. Liga/i.test(name)) return '3. Liga Süd';
  if (/Bundesliga Frauen/i.test(name) || name === '1. BL') return '1. BL';
  if (/pokal/i.test(name)) return 'DHB-Pokal';
  return name;
}
